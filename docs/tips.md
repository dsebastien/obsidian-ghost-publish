---
title: Tips & best practices
nav_order: 90
---

# Tips and best practices

## One preset, one workflow

Treat each preset as a distinct publication workflow. Common ideas:

- **Blog post** — tag `blog-post`, status `published`, no newsletter (or one for major posts only).
- **News** — tag `news`, optional newsletter for opted-in subscribers, often with `canonical_url` enabled.
- **Microblog** — tag `microblog`, status `published`, no canonical URL, no listing note.
- **Draft** — status `draft`, no tags (or a `draft` tag), so you can review in Ghost Admin before clicking publish.

A note can only be assigned to **one preset at a time** (the preset id is stored in frontmatter). To re-publish a note under a different preset, remove it from the queue first.

## Idempotency via content hash

Each successful sync writes a SHA-256 of the body to the configured content-hash frontmatter key. Re-running the sync without editing the note short-circuits to `unchanged`. Edit anything in the body to force a re-publish.

## Newsletter emails fire once

If a note has the email flag set and no `emailed_at`, the first sync creates the post as a draft, then transitions it to published with the newsletter slug — that's the only Ghost transition that fires the email. After that, `emailed_at` is set and subsequent updates never re-send.

To re-trigger the email, you'd need to delete the post in Ghost AND clear the `emailed_at` frontmatter field. The plugin won't do this for you.

## YouTube and bookmark cards

- **YouTube card:** write `![](https://www.youtube.com/watch?v=…)` or the `youtu.be/…` short form on its own line.
- **Bookmark card:** start a paragraph with `LINK:` followed by a URL — either inline (`LINK: https://…`) or as a list (`LINK:` then `- https://…` on the next line). Wikilinks resolve via the known-URL map or your public mirror.

The plugin first inserts a marker paragraph, then upgrades it post-creation via Ghost's lexical API. If the oembed lookup fails, the marker stays.

## Footnotes

Markdown footnotes are published as proper footnotes:

- **Reference + definition:** `A claim.[^1]` somewhere in the body, with `[^1]: The source.` on its own line (definitions can span multiple indented lines).
- **Inline footnote:** `A statement.^[An aside written inline.]`

Footnotes are numbered by the order their references first appear, not the order the definitions are written. A definition that is never referenced is dropped, and a reference with no matching definition is left as literal text. The rendered post gets superscript anchors and a footnotes section at the bottom.

## Bring your own frontmatter

If you already use a specific naming convention, set the frontmatter properties in settings to match. Every key is configurable. The plugin reads / writes only what you tell it to.

## Troubleshooting

### "Missing Ghost configuration"

Fill in Ghost URL and Admin API key in settings. The Admin key can come from `GHOST_ADMIN_KEY` if you'd prefer to keep it out of the plugin data file.

### "canonical URL not reachable"

Either your mirror hasn't finished publishing the note, the path contains a character that needs different encoding, or your Notes base URL is wrong. Compare the resolved URL (debug mode → developer console) to a working one.

### A post got recreated rather than updated

A Ghost id was present on the note but Ghost returned 404 — usually because the post was deleted in Ghost Admin. The new id replaces the old one in frontmatter.

### Refresh button does nothing

Verify the Ghost URL has no trailing slash and the Admin key is `id:secret`. If the request fails, the notice surfaces the Ghost error message — usually an auth issue (wrong secret, missing scopes).

### "Preset not found" notice

Happens if the panel had a stale active preset id (e.g. you deleted a preset while the panel was open). Click the panel's refresh button.
