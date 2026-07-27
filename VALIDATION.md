# City Alert Data Validation

## Mission JSON Validator

This repository includes a validation script to check the integrity of mission JSON files.

### Features

✅ **Structural Validation:**
- Unique task IDs
- Required fields (id, name, lat, lng, type)
- Valid task types
- Coordinate ranges (-90 to 90 lat, -180 to 180 lng)

✅ **Reference Validation:**
- `nextTaskId` references exist
- `reward.transformedImage` references valid task ID
- Image files exist in `/img/{challenge}/`
- Audio files exist in `/audio/{challenge}/`
- Collection references (e.g., `random: "paintings"`)

✅ **Type-Specific Validation:**
- Timeline/timepointer: events order (1,2,3,4)
- PhotoValidation: required `prompt` field
- Fallback structure validation

✅ **Content Warnings:**
- Unused image files
- Duplicate `nextTaskId` (branching detection)
- Numeric constraints (points, attempts, time)

### Usage

**Validate all missions:**
```bash
npm run validate
```

**Validate specific mission:**
```bash
npm run validate london.json
```

Or directly:
```bash
node scripts/validate.js london.json
```

### Example Output

```
🔍 City Alert Mission Data Validator

📝 Validating london.json...
ℹ Found 16 tasks
  ✓ All 16 task IDs are unique
  ⚠ 10 unused images: caravaggio.jpg, ciurlionis.jpg...

✅ All validations PASSED
```

### Exit Codes

- `0` - All validations passed
- `1` - Validation failed (errors found)

### Integration

**Pre-commit Hook:**
Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
npm run validate
if [ $? -ne 0 ]; then
  echo "❌ Validation failed. Fix errors before committing."
  exit 1
fi
```

**GitHub Actions:**
`.github/workflows/validate-stage.yml` runs `npm test` on every push to `stage`.
On failure it emails `NOTIFY_MAIL_TO` (requires repo secrets `SMTP_USER`, `SMTP_PASS`, `NOTIFY_MAIL_TO`).

### Validation Rules

- **Task ID**: Must be unique across the mission
- **Required fields**: `id`, `name`, `lat`, `lng` (type defaults to `text_answer`)
- **Coordinates**: lat (-90 to 90), lng (-180 to 180)
- **nextTaskId**: Must reference an existing task ID
- **Images**: Must exist in `v1/img/{challenge}/`
- **Collections**: Must exist in `city-alert/config/`
- **Timeline order**: Should be sequential (1, 2, 3, 4)
- **Points**: Cannot be negative
- **Attempts/Time**: Must be positive

### Common Errors

**Invalid type:**
```
✗ Task "9": Invalid type "audio". Must be one of: text_answer, wordle...
```
Solution: Use a valid task type or omit `type` field (defaults to `text_answer`)

**Missing required field:**
```
✗ Task "5": Missing required field "lat"
```
Solution: Add the required field (`id`, `name`, `lat`, `lng`)

**Image not found:**
```
✗ Task "3": Image file not found: missing.jpg
```
Solution: Add the image to `v1/img/{challenge}/` or fix the filename

**Invalid nextTaskId:**
```
✗ Task "7": nextTaskId "999" does not exist
```
Solution: Fix the task ID reference or add the missing task

**Invalid transformedImage:**
```
✗ Task "3": reward.transformedImage "999" references non-existent task
```
Solution: Ensure `transformedImage` points to an existing task ID

**Branching detected:**
```
⚠ Multiple tasks point to task "5": 3, 4 (possible branching)
```
Info: This is a warning, not an error. Multiple tasks leading to the same task creates branching in the mission flow.

### Supported Task Types

- `text_answer` (default if not specified)
- `wordle`
- `photoValidation`
- `timepointer`
- `timeline`
- `team_name`
- `roulette`
- `audio`

