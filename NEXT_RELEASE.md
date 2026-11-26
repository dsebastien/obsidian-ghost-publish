### The link back to your note and the canonical URL are now two settings

Each preset used to have one **Canonical URL** switch. It did two things: it added a line at the top of the post that links back to your note, and it told search engines that your note is the original (the post's canonical URL). You can now choose each one on its own, in the preset editor:

- **Link back to the note**: the post starts with a line that links to the note on your notes site.
- **Point the canonical URL to the note**: search engines treat the note as the original. Turn it off, and keep the link back on, to make the post the original.

**Nothing to do.** A preset that had **Canonical URL** on gets both settings on, and a preset that had it off gets both off. Your posts stay as they are.

When you turn **Point the canonical URL to the note** off, the next update of a post removes the canonical URL that the plugin had set. A canonical URL that you set by hand in Ghost to another address is kept.

### Keep the address of each post in its note

A new optional property, **Post URL**, is in **Settings → Ghost Publish → Frontmatter properties**. Type a property name (for example `ghost_publish_url`), and after each sync that creates or updates a post, the plugin writes the public address of the post into the note. It writes only when the address changed. A draft or a scheduled post has no public address yet, so nothing is written for it. The property is empty by default, so nothing changes until you set it.
