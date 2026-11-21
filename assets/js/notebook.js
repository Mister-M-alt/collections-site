(function () {
  "use strict";

  function normalize(text) {
    return String(text || "").normalize("NFKD").replace(/\p{M}/gu, "")
      .toLocaleLowerCase().replace(/\s+/g, " ").trim();
  }

  function localDate() {
    const today = new Date();
    return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")].join("-");
  }

  function cleanTitle(value) {
    return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, 100);
  }

  function slugFor(title) {
    return normalize(title).replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/g, "") || "note";
  }

  function headingText(title) {
    return title.replace(/[\\`*_\[\]<>]/g, "\\$&");
  }

  function isSafeFolder(value) {
    return typeof value === "string" && value.length <= 240 &&
      /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i.test(value);
  }

  function createFileURL(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.hostname !== "github.com" ||
          url.port || url.username || url.password || url.search || url.hash ||
          !/^\/[a-z0-9_.-]+\/[a-z0-9_.-]+\/new\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/i.test(url.pathname)) return null;
      if (url.pathname.split("/").some(function (part) { return part === "." || part === ".."; })) return null;
      return url;
    } catch (_) {
      return null;
    }
  }

  function makeTemplate(title, type, date) {
    const heading = "# " + headingText(title || "Your note title") + "\n\n";
    const created = "Created: " + date + "\n\n";
    const references = "## Sources\n\n- Add a source URL or reference.\n\n" +
      "## Related notes\n\n- Add a relative Markdown link to a related note.\n";
    if (type === "concept") {
      return heading + created +
        "## In my own words\n\nExplain the idea briefly.\n\n" +
        "## Why it matters\n\nWhen would I use this?\n\n" +
        "## Example\n\nAdd an example, calculation, or diagram.\n\n" +
        "## Questions and limits\n\nWhat is still unclear? When does this explanation stop applying?\n\n" + references;
    }
    if (type === "runbook") {
      return heading + created +
        "## Goal\n\nWhat should this procedure achieve?\n\n" +
        "## Preconditions\n\nList the required environment, access, and tools.\n\n" +
        "## Steps\n\n1. Describe the first action.\n2. Describe the next action.\n\n" +
        "## Check the result\n\nWhat confirms that the procedure worked?\n\n" +
        "## If it fails\n\nRecord the symptoms, recovery steps, and limits.\n\n" + references;
    }
    return heading + created +
      "## Notes\n\nWrite the observation, idea, or question here.\n\n" +
      "## Next step\n\nWhat should I check, try, or read next?\n\n" + references;
  }

  function initializeNewNote() {
    const form = document.getElementById("kb-note-form");
    if (!form || form.dataset.kbReady === "true") return;
    const wrapper = document.getElementById("kb-new-note-ui");
    const title = document.getElementById("kb-note-title");
    const topic = document.getElementById("kb-note-topic");
    const type = document.getElementById("kb-note-template");
    const path = document.getElementById("kb-note-path");
    const preview = document.getElementById("kb-note-preview");
    const openLink = document.getElementById("kb-note-open");
    const copyButton = document.getElementById("kb-note-copy");
    const status = document.getElementById("kb-note-status");
    const copyFallback = document.getElementById("kb-note-copy-fallback");
    if (!wrapper || !title || !topic || !type || !path || !preview ||
        !openLink || !copyButton || !status || !copyFallback) return;

    form.dataset.kbReady = "true";
    const repositoryNewFile = createFileURL(form.dataset.newFileUrl);
    const folderValues = Array.from(topic.options).map(function (option) { return option.value; })
      .filter(isSafeFolder);
    const folders = new Set(folderValues);
    const fallbackFolder = folderValues[0];
    if (!repositoryNewFile || !fallbackFolder) {
      title.disabled = true;
      topic.disabled = true;
      type.disabled = true;
      copyButton.disabled = true;
      openLink.removeAttribute("href");
      openLink.setAttribute("aria-disabled", "true");
      openLink.setAttribute("tabindex", "-1");
      status.textContent = "The note form could not be prepared. Use the repository’s Add file action.";
      wrapper.hidden = false;
      return;
    }
    let currentTemplate = "";

    function update() {
      const noteTitle = cleanTitle(title.value);
      const folder = folders.has(topic.value) ? topic.value : fallbackFolder;
      const date = localDate();
      currentTemplate = makeTemplate(noteTitle, type.value, date);
      preview.textContent = currentTemplate;
      copyFallback.hidden = true;
      copyFallback.value = "";
      copyButton.disabled = !noteTitle;
      openLink.setAttribute("aria-disabled", noteTitle ? "false" : "true");
      status.textContent = noteTitle ? "" : "Enter a title to prepare your note.";

      if (!noteTitle) {
        path.textContent = "Enter a title to generate a filename.";
        openLink.removeAttribute("href");
        openLink.setAttribute("tabindex", "-1");
        return;
      }

      const filename = folder + "/" + date + "-" + slugFor(noteTitle) + ".md";
      const destination = new URL(repositoryNewFile.href);
      destination.searchParams.set("filename", filename);
      destination.searchParams.set("value", currentTemplate);
      path.textContent = filename;
      openLink.href = destination.href;
      openLink.removeAttribute("tabindex");
    }

    form.addEventListener("submit", function (event) { event.preventDefault(); });
    title.addEventListener("input", update);
    topic.addEventListener("change", update);
    type.addEventListener("change", update);
    openLink.addEventListener("click", function (event) {
      if (!cleanTitle(title.value)) {
        event.preventDefault();
        title.reportValidity();
        title.focus();
      }
    });
    copyButton.addEventListener("click", async function () {
      if (!cleanTitle(title.value)) return;
      const template = currentTemplate;
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(template);
        status.textContent = "Template copied. Paste it into GitHub if needed.";
      } catch (_) {
        copyFallback.value = template;
        copyFallback.hidden = false;
        copyFallback.focus();
        copyFallback.select();
        status.textContent = "Copy the selected template below, then paste it into GitHub.";
      }
    });

    update();
    wrapper.hidden = false;
  }

  function initializeFilter() {
    const input = document.getElementById("kb-filter");
    if (!input || input.dataset.kbReady === "true") return;
    const rows = Array.from(document.querySelectorAll(".kb-note-row"));
    const status = document.querySelector(".kb-filter-status");
    const clearButton = document.getElementById("kb-clear-filter");
    const searchable = rows.map(function (row) { return normalize(row.textContent); });
    input.dataset.kbReady = "true";
    if (status) {
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
    }

    function filter() {
      const query = normalize(input.value);
      const terms = query.split(" ").filter(Boolean);
      let count = 0;
      rows.forEach(function (row, index) {
        const matches = terms.every(function (term) { return searchable[index].includes(term); });
        row.hidden = !matches;
        if (matches) count += 1;
      });
      if (status) status.textContent = query ? count + " of " + rows.length + " notes" :
        rows.length + (rows.length === 1 ? " note" : " notes");
      if (clearButton) {
        clearButton.disabled = !query;
        clearButton.hidden = !query;
      }
    }

    input.addEventListener("input", filter);
    if (clearButton) clearButton.addEventListener("click", function () {
      input.value = "";
      filter();
      input.focus();
    });
    filter();
  }

  function initialize() {
    initializeNewNote();
    initializeFilter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
  if (typeof document$ !== "undefined" && document$ && typeof document$.subscribe === "function") {
    document$.subscribe(initialize);
  }
})();
