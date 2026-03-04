import os
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "SonicSplits API is running"}

def test_status_not_found():
    response = client.get("/status/non-existent-job")
    assert response.status_code == 200
    assert response.json()["status"] == "not_found"

def test_upload_no_file():
    response = client.post("/upload")
    assert response.status_code == 422 # Validation error
