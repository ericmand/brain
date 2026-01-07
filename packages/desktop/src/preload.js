// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

// Set up the SDK logger bridge between main and renderer
contextBridge.exposeInMainWorld("sdkLoggerBridge", {
  // Receive logs from main process
  onSdkLog: (callback) => {
    const handler = (_, logEntry) => callback(logEntry);
    ipcRenderer.on("sdk-log", handler);
    return () => ipcRenderer.removeListener("sdk-log", handler);
  },

  // Send logs from renderer to main process
  sendSdkLog: (logEntry) => ipcRenderer.send("sdk-log", logEntry),
});

contextBridge.exposeInMainWorld("electronAPI", {
  navigate: (page) => ipcRenderer.send("navigate", page),
  saveMeetingsData: (data) => ipcRenderer.invoke("saveMeetingsData", data),
  loadMeetingsData: () => ipcRenderer.invoke("loadMeetingsData"),
  deleteMeeting: (meetingId) => ipcRenderer.invoke("deleteMeeting", meetingId),
  generateMeetingSummary: (meetingId) =>
    ipcRenderer.invoke("generateMeetingSummary", meetingId),
  generateMeetingSummaryStreaming: (meetingId) =>
    ipcRenderer.invoke("generateMeetingSummaryStreaming", meetingId),
  startManualRecording: (meetingId) =>
    ipcRenderer.invoke("startManualRecording", meetingId),
  stopManualRecording: (recordingId) =>
    ipcRenderer.invoke("stopManualRecording", recordingId),
  debugGetHandlers: () => ipcRenderer.invoke("debugGetHandlers"),
  checkForDetectedMeeting: () => ipcRenderer.invoke("checkForDetectedMeeting"),
  joinDetectedMeeting: () => ipcRenderer.invoke("joinDetectedMeeting"),
  onOpenMeetingNote: (callback) => {
    const handler = (_, meetingId) => callback(meetingId);
    ipcRenderer.on("open-meeting-note", handler);
    return () => ipcRenderer.removeListener("open-meeting-note", handler);
  },
  onRecordingCompleted: (callback) => {
    const handler = (_, meetingId) => callback(meetingId);
    ipcRenderer.on("recording-completed", handler);
    return () => ipcRenderer.removeListener("recording-completed", handler);
  },
  onTranscriptUpdated: (callback) => {
    const handler = (_, meetingId) => callback(meetingId);
    ipcRenderer.on("transcript-updated", handler);
    return () => ipcRenderer.removeListener("transcript-updated", handler);
  },
  onSummaryGenerated: (callback) => {
    const handler = (_, meetingId) => callback(meetingId);
    ipcRenderer.on("summary-generated", handler);
    return () => ipcRenderer.removeListener("summary-generated", handler);
  },
  onSummaryUpdate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("summary-update", handler);
    return () => ipcRenderer.removeListener("summary-update", handler);
  },
  onRecordingStateChange: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("recording-state-change", handler);
    return () =>
      ipcRenderer.removeListener("recording-state-change", handler);
  },
  onParticipantsUpdated: (callback) => {
    const handler = (_, meetingId) => callback(meetingId);
    ipcRenderer.on("participants-updated", handler);
    return () => ipcRenderer.removeListener("participants-updated", handler);
  },
  onVideoFrame: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("video-frame", handler);
    return () => ipcRenderer.removeListener("video-frame", handler);
  },
  onMeetingDetectionStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("meeting-detection-status", handler);
    return () => ipcRenderer.removeListener("meeting-detection-status", handler);
  },
  onMeetingTitleUpdated: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("meeting-title-updated", handler);
    return () => ipcRenderer.removeListener("meeting-title-updated", handler);
  },
  getActiveRecordingId: (noteId) =>
    ipcRenderer.invoke("getActiveRecordingId", noteId),

  // Auth APIs
  auth: {
    isAuthenticated: () => ipcRenderer.invoke("auth:isAuthenticated"),
    login: () => ipcRenderer.invoke("auth:login"),
    logout: () => ipcRenderer.invoke("auth:logout"),
    onAuthStateChanged: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on("auth-state-changed", handler);
      return () => ipcRenderer.removeListener("auth-state-changed", handler);
    },
  },
});
