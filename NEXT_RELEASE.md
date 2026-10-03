### Your Ghost Admin API key is now kept in Obsidian's secret storage

The Admin API key used to be saved in plain text in the plugin's data file, which travels with your vault when you sync it (git, Syncthing, cloud). It now lives in Obsidian's secret storage, which stays on each device. The plugin data only keeps the name of the secret.

- **Nothing to do.** Every device moves the key into its own secret storage automatically the next time it starts, and stays connected to Ghost.
- The old plain-text copy is kept for 60 days so all your synced devices can pick it up, then removed automatically. Once all your devices run this version, you can remove it right away with **Remove plain-text copy now** in **Settings → Ghost Publish**.
- To use another key, pick or create a different secret in the **Ghost Admin API key** setting. **Forget key** clears the key from this device.
- On a brand-new device, the settings tell you if the key still needs to be set there.
