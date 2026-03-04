import os
import shutil
import subprocess
import uuid
import glob
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use absolute paths for directories to avoid issues with different working directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
SEPARATED_DIR = os.path.join(BASE_DIR, "separated")
BIN_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "bin")) # ffmpeg is here

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(SEPARATED_DIR, exist_ok=True)

app.mount("/separated", StaticFiles(directory=SEPARATED_DIR), name="separated")

jobs = {}

class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: int
    files: List[str] = []

@app.get("/")
async def root():
    return {"message": "SonicSplits API is running"}

@app.post("/upload")
async def upload_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...), stems: str = Form("2")):
    job_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    jobs[job_id] = {"status": "processing", "progress": 0, "files": []}
    background_tasks.add_task(separate_audio, job_id, file_path, stems)

    return {"job_id": job_id}

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    return jobs.get(job_id, {"status": "not_found", "progress": 0, "files": []})

def separate_audio(job_id: str, file_path: str, stems: str):
    try:
        job_output_root = os.path.join(SEPARATED_DIR, job_id)
        os.makedirs(job_output_root, exist_ok=True)

        # Demucs command
        # Use --filename "{stem}.{ext}" to keep it simple
        cmd = ["demucs", "-o", job_output_root, "--filename", "{stem}.{ext}"]
        if stems == "2":
            cmd.extend(["--two-stems", "vocals"])

        cmd.append(file_path)

        # Ensure ffmpeg is in path
        env = os.environ.copy()
        env["PATH"] = BIN_DIR + ":" + env["PATH"]

        # Use a more robust way to run demucs
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)

        for line in process.stdout:
            print(f"[{job_id}] {line.strip()}")
            # Simple progress mock
            if "Separating track" in line:
                jobs[job_id]["progress"] = 10
            elif "100%|" in line:
                 jobs[job_id]["progress"] = 80

        process.wait()

        if process.returncode == 0:
            # Demucs structure: output_dir/model_name/track_name/stem.ext
            # We want: SEPARATED_DIR/job_id/stem.ext

            # Find all .wav or .mp3 files recursively in the output folder
            found_files = glob.glob(os.path.join(job_output_root, "**", "*.wav"), recursive=True)
            found_files.extend(glob.glob(os.path.join(job_output_root, "**", "*.mp3"), recursive=True))

            generated_urls = []
            for f in found_files:
                filename = os.path.basename(f)
                dest = os.path.join(job_output_root, filename)
                if f != dest:
                    shutil.move(f, dest)
                generated_urls.append(f"/separated/{job_id}/{filename}")

            # Cleanup model and track subdirectories
            # This is simple: just delete everything except the files in job_output_root
            for item in os.listdir(job_output_root):
                item_path = os.path.join(job_output_root, item)
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)

            jobs[job_id]["status"] = "completed"
            jobs[job_id]["progress"] = 100
            jobs[job_id]["files"] = generated_urls
        else:
            jobs[job_id]["status"] = "failed"

    except Exception as e:
        print(f"Error in separate_audio: {e}")
        jobs[job_id]["status"] = "failed"
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
