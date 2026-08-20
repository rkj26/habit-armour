import os
from datetime import datetime
from typing import Any

from app.config import settings


def format_journal_markdown(entry_type: str, date_str: str, data: dict[str, Any]) -> str:
    """Formats journal entry into clean Obsidian Markdown."""
    lines = []
    lines.append(f"## {entry_type.capitalize()} Journal - {date_str}")
    lines.append(f"*Logged at {datetime.now().strftime('%H:%M:%S')}*")
    lines.append("")

    if entry_type == "morning":
        if data.get("wakingState"):
            lines.append(f"**Waking State & Energy:** {data['wakingState']}")
        if data.get("dailyIntention"):
            lines.append(f"**Daily Intention / Focus:** {data['dailyIntention']}")
        if data.get("gratitude"):
            lines.append(f"**Gratitude:** {data['gratitude']}")
        if data.get("freeform"):
            lines.append("")
            lines.append("### Morning Reflections")
            lines.append(data["freeform"])
    elif entry_type == "night":
        if data.get("dailyHighlights"):
            lines.append(f"**Daily Highlights & Wins:** {data['dailyHighlights']}")
        if data.get("lessonsLearned"):
            lines.append(f"**Lessons & Growth:** {data['lessonsLearned']}")
        if data.get("tomorrowPrep"):
            lines.append(f"**Tomorrow Preparation:** {data['tomorrowPrep']}")
        if data.get("freeform"):
            lines.append("")
            lines.append("### Night Reflections")
            lines.append(data["freeform"])

    lines.append("")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def sync_to_obsidian(
    entry_type: str,
    date_str: str,
    data: dict[str, Any],
    vault_path: str | None = None,
    journal_folder: str | None = None,
) -> bool:
    vault = vault_path or settings.OBSIDIAN_VAULT_PATH
    folder = journal_folder or settings.OBSIDIAN_JOURNAL_FOLDER

    if not vault or not os.path.isdir(vault):
        print(f"[obsidian] Vault path '{vault}' not found. Skipping Obsidian sync.")
        return False

    target_dir = os.path.join(vault, folder) if folder else vault
    os.makedirs(target_dir, exist_ok=True)

    file_path = os.path.join(target_dir, f"{date_str}.md")
    content = format_journal_markdown(entry_type, date_str, data)

    try:
        if os.path.exists(file_path):
            with open(file_path, "a", encoding="utf-8") as f:
                f.write("\n" + content)
        else:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(f"# Daily Log: {date_str}\n\n" + content)
        print(f"[obsidian] Successfully wrote journal to {file_path}")
        return True
    except Exception as e:
        print(f"[obsidian] Error writing to Obsidian: {e}")
        return False
