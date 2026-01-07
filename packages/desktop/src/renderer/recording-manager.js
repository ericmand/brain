function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

function createRecordingManager({ updateRecordingButtonUI }) {
  async function startRecording(noteId, recordButton) {
    if (!noteId) {
      return { success: false, error: "Missing note ID" };
    }

    if (recordButton) {
      recordButton.disabled = true;
    }

    try {
      const result = await window.electronAPI.startManualRecording(noteId);

      if (result.success) {
        updateRecordingButtonUI(true, result.recordingId);
        showToast("Recording started...");
        return result;
      }

      return {
        success: false,
        error: result.error || "Failed to start recording",
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    } finally {
      if (recordButton) {
        recordButton.disabled = false;
      }
    }
  }

  async function stopRecording(recordingId, recordButton) {
    if (!recordingId) {
      return { success: false, error: "Missing recording ID" };
    }

    if (recordButton) {
      recordButton.disabled = true;
    }

    try {
      const result = await window.electronAPI.stopManualRecording(recordingId);

      if (result.success) {
        updateRecordingButtonUI(false, null);
        showToast("Recording stopped. Generating summary...");
        return result;
      }

      return {
        success: false,
        error: result.error || "Failed to stop recording",
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    } finally {
      if (recordButton) {
        recordButton.disabled = false;
      }
    }
  }

  return {
    startRecording,
    stopRecording,
  };
}

export { createRecordingManager };
