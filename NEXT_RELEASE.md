### The link back to your note and the canonical URL are now two settings

Each preset used to have one **Canonical URL** switch. It did two things: it added a line at the top of the post that links back to your note, and it told search engines that your note is the original (the post's canonical URL). You can now choose each one on its own, in the preset editor:

- **Link back to the note**: the post starts with a line that links to the note on your notes site.
- **Text of the link back**: the words before the note title in that line. The default is "Canonical version:", the text used until now.
- **Point the canonical URL to the note**: search engines treat the note as the original. Turn it off, and keep the link back on, to make the post the original.

**Nothing to do.** A preset that had **Canonical URL** on gets both settings on, and a preset that had it off gets both off. The text of the line does not change. Your posts stay as they are.

**If you sync this vault between devices**, update every device to this version before you change these settings. An older version drops the new settings when it saves its own.

When **Point the canonical URL to the note** is off, a post whose `canonical_url` is equal to the note URL gets it cleared at its next update. A canonical URL that you set by hand in Ghost to another address is kept. A note that did not change is not sent to Ghost, so its post is updated only after the next change of the note, or with the new command below.

### Sync again every note of a preset

The new command **Sync again every note of a preset** sends every note of the preset that is already on Ghost again, also the notes that did not change. Use it once after you change the link or canonical URL settings, to apply them to your live posts. It asks for confirmation first and says how many posts it will update. It never sends a newsletter email, and it leaves notes that are not on Ghost yet to the normal sync.

### Keep the address of each post in its note

A new optional property, **Post URL**, is in **Settings → Ghost Publish → Frontmatter properties**. Type a property name (for example `ghost_publish_url`), and after each sync that creates or updates a post, the plugin writes the public address of the post into the note. It writes only when the address changed. A draft or a scheduled post has no public address yet, so nothing is written for it. The name must not be one that the plugin already uses (another property in that list, `title`, `published`, `date_published`, `date_updated`, `created` or `updated`). The property is empty by default, so nothing changes until you set it.
