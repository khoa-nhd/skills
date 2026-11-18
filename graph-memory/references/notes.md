# Project notes

The file is `.claude/graph-memory.md` in the project root, created by `gm.py init` from `assets/notes-template.md`.

## Sections

| Section | Shown to every new chat? | Content |
|---|---|---|
| Now | yes | What is in progress, where it stopped (file or function), the next concrete step, open questions. Replace it on each save rather than appending. At most 6 lines. |
| Rules | yes | Project conventions and gotchas the code does not make obvious, and any "always" or "never" the user stated. At most 10 lines. |
| Overview | yes | What the project is, the stack, entry points, how to run and test. About 5 lines. |
| Decisions | no, read on demand | `YYYY-MM-DD - decision - why`, newest first. Read it when making a related choice. |
| Log | no, read on demand | `YYYY-MM-DD - what was done`, newest first. Keep the last 10 lines. |

The session note shows at most 10 lines per hot section and 30 in total. Anything beyond that is cut, which is one more reason to keep the hot sections tight.

## What belongs here

Keep the things a future chat would otherwise rediscover at a cost, or get wrong:

- decisions and the reasons behind them;
- the user's preferences for this project;
- where the work stopped;
- commands that are not obvious;
- traps someone hit.

Leave out anything the graph or the code already says: file lists, signatures, what a function does. Also leave out long explanations, chat transcripts, and anything sensitive (keys, tokens, passwords, personal data).

Write in terse English, which costs fewer tokens than Vietnamese with diacritics. Keep names, UI strings and error messages exactly as they are.

## Save procedure

1. Read the notes file. It is small.
2. From this session, collect new decisions and rules, the state of unfinished work, and what was completed. If the user passed a note (`/graph-memory save <note>`), include it.
3. Edit the file in place:
   - replace Now;
   - add to Decisions and Rules, merging duplicates and dropping items that are no longer true;
   - add one Log line for today, unless today's work is already logged (for example by a `use` task), and drop Log lines beyond the last 10.
4. Keep the file under about 80 lines. If it is over, shorten the Log, merge Rules, and remove detail that no new chat needs.
5. If code changed this session and the graph was not refreshed, run `gm.py update`.
6. Tell the user in one or two lines what changed in the notes.
