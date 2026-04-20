# Mode: apply — Live Application Assistant

Interactive mode for when the candidate fills a job application form. Reads the page, loads prior offer context, and generates personalized answers for each form question.

## Requirements

- **Best with agent-browser (visible)**: Candidate sees the browser, Claude can interact with the page.
- **Without agent-browser**: Candidate shares a screenshot or pastes form questions manually.

## Workflow

```
1. DETECT     → Read active Chrome tab (screenshot/URL/title)
2. IDENTIFY   → Extract company + role from page
3. LOOKUP     → Match against existing reports in reports/
4. LOAD       → Read full report + Section G (if exists)
5. COMPARE    → Does page role match evaluated role? Changed → warn
6. ANALYZE   → Identify ALL visible form questions
7. GENERATE   → For each question, generate personalized answer
8. PRESENT    → Show formatted answers for copy-paste
```

## Step 1 — Detect the Offer

**With agent-browser:** `agent-browser snapshot -i --json` to read title, URL, and visible content.

**Without:** Ask the candidate to:
- Share a screenshot of the form (Read tool reads images)
- Or paste form questions as text
- Or name company + role so we can search

## Step 2 — Identify and lookup context

1. Extract company name and role title from the page
2. Search `reports/` for company name (case-insensitive grep)
3. If match → load full report
4. If Section G exists → load previous draft answers as base
5. If NO match → warn and offer to run auto-pipeline

## Step 3 — Detect role changes

If the on-screen role differs from the evaluated role:
- **Warn the candidate**: "Role changed from [X] to [Y]. Re-evaluate or adapt answers?"
- **If adapting**: Adjust answers to new role without re-evaluating
- **If re-evaluating**: Run full A-F evaluation, update report, regenerate Section G
- **Update tracker**: Change role title in applications.md if needed

## Step 4 — Analyze form questions

Identify ALL visible questions:
- Free-text fields (cover letter, why this role, etc.)
- Dropdowns (how did you hear, work authorization, etc.)
- Yes/No (relocation, visa, etc.)
- Salary fields (range, expectation)
- Upload fields (resume, cover letter PDF)

Classify each question:
- **Already answered in Section G** → adapt existing answer
- **New question** → generate from report + cv.md

## Step 5 — Generate answers

For each question, generate the answer following:

1. **Report context**: Use proof points from Block B, STAR stories from Block F
2. **Prior Section G**: If draft answer exists, use as base and refine
3. **"I'm choosing you" tone**: Same framework as auto-pipeline
4. **Specificity**: Reference something concrete from the on-screen JD
5. **career-ops proof point**: Include in "Additional info" if field available

**Output format:**

```
## Answers for [Company] — [Role]

Based on: Report #NNN | Score: X.X/5 | Archetype: [type]

---

### 1. [Exact form question]
> [Copy-paste ready answer]

### 2. [Next question]
> [Answer]

...

---

Notes:
- [Any observations about the role, changes, etc.]
- [Personalization suggestions the candidate should review]
```

**After generating any temporary resume/HTML files for this application:** Delete them immediately after the candidate has uploaded the file to the form. Also clean up any XeLaTeX build artifacts (`.aux`, `.log`, `.fls`, `.fdb_latexmk`, `.out`) in the same directory. Temp files live in `output/` — clean up anything with `tmp`, `temp`, or a dated pattern that was created just for this application.

## Step 6 — Post-apply (optional)

If the candidate confirms application submitted:
1. Update status in `applications.md` from "Evaluated" to "Applied"
2. Update Section G of report with final answers
3. Suggest next step: `/career-ops contacto` for LinkedIn outreach

## Scroll handling

If the form has more questions than visible:
- Ask candidate to scroll and share another screenshot
- Or paste remaining questions
- Process in iterations until all questions covered
