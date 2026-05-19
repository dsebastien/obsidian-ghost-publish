import { Modal } from 'obsidian'
import type { App } from 'obsidian'

export class ConfirmModal extends Modal {
    private readonly title: string
    private readonly message: string
    private readonly onConfirm: () => void

    constructor(app: App, title: string, message: string, onConfirm: () => void) {
        super(app)
        this.title = title
        this.message = message
        this.onConfirm = onConfirm
    }

    override onOpen(): void {
        this.titleEl.setText(this.title)
        const { contentEl } = this
        contentEl.empty()
        contentEl.createEl('p', { text: this.message })

        const footer = contentEl.createDiv({ cls: 'gp-modal-footer' })
        const confirmBtn = footer.createEl('button', { text: 'Confirm', cls: 'mod-warning' })
        confirmBtn.addEventListener('click', () => {
            this.onConfirm()
            this.close()
        })
        const cancelBtn = footer.createEl('button', { text: 'Cancel' })
        cancelBtn.addEventListener('click', () => this.close())
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
