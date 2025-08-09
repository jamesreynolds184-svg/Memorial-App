const memorialsUrl = "/data/memorials.json";

async function loadMemorials() {
  try {
    const response = await fetch(memorialsUrl);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const memorials = await response.json();
    return memorials;
  } catch (error) {
    console.error("Failed to load memorial data:", error);
    return [];
  }
}

export { loadMemorials };