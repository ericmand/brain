const DEFAULT_MEETINGS_DATA = {
  upcomingMeetings: [],
  pastMeetings: [],
};

const meetingsData = {
  upcomingMeetings: [],
  pastMeetings: [],
};

let pastMeetingsByDate = {};

function normalizeMeetingsData(data) {
  return {
    upcomingMeetings: Array.isArray(data?.upcomingMeetings)
      ? data.upcomingMeetings
      : [],
    pastMeetings: Array.isArray(data?.pastMeetings) ? data.pastMeetings : [],
  };
}

function cloneMeetingsData(data) {
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

function rebuildPastMeetingsByDate() {
  pastMeetingsByDate = {};
  meetingsData.pastMeetings
    .filter((meeting) => meeting.type !== "calendar")
    .forEach((meeting) => {
      const dateKey = new Date(meeting.date).toDateString();
      if (!pastMeetingsByDate[dateKey]) {
        pastMeetingsByDate[dateKey] = [];
      }
      pastMeetingsByDate[dateKey].push(meeting);
    });
}

function setMeetingsData(nextData) {
  const normalized = normalizeMeetingsData(nextData || DEFAULT_MEETINGS_DATA);
  meetingsData.upcomingMeetings = normalized.upcomingMeetings;
  meetingsData.pastMeetings = normalized.pastMeetings;
  rebuildPastMeetingsByDate();
}

function getMeetingsData() {
  return meetingsData;
}

function getPastMeetingsByDate() {
  return pastMeetingsByDate;
}

function getAllMeetings({ includeCalendar = false } = {}) {
  const all = meetingsData.upcomingMeetings.concat(meetingsData.pastMeetings);
  if (includeCalendar) {
    return all;
  }
  return all.filter((meeting) => meeting.type !== "calendar");
}

function findMeetingById(id, data = meetingsData) {
  const all = data.upcomingMeetings.concat(data.pastMeetings);
  return all.find((meeting) => meeting.id === id);
}

async function persistMeetingsData(nextData) {
  try {
    const result = await window.electronAPI.saveMeetingsData(nextData);
    if (!result?.success) {
      return {
        success: false,
        error: result?.error || "Unknown error while saving meetings data",
      };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
}

async function updateMeetingsData(updateFn) {
  const draft = cloneMeetingsData(meetingsData);
  updateFn(draft);
  const result = await persistMeetingsData(draft);
  if (result.success) {
    setMeetingsData(draft);
  }
  return result;
}

async function updateMeetingById(meetingId, updater) {
  return updateMeetingsData((draft) => {
    const meeting = findMeetingById(meetingId, draft);
    if (meeting) {
      updater(meeting);
    }
  });
}

async function addPastMeeting(meeting) {
  return updateMeetingsData((draft) => {
    draft.pastMeetings.unshift(meeting);
  });
}

async function removeMeetingById(meetingId) {
  return updateMeetingsData((draft) => {
    draft.pastMeetings = draft.pastMeetings.filter(
      (meeting) => meeting.id !== meetingId,
    );
    draft.upcomingMeetings = draft.upcomingMeetings.filter(
      (meeting) => meeting.id !== meetingId,
    );
  });
}

export {
  addPastMeeting,
  findMeetingById,
  getAllMeetings,
  getMeetingsData,
  getPastMeetingsByDate,
  removeMeetingById,
  setMeetingsData,
  updateMeetingById,
  updateMeetingsData,
};
