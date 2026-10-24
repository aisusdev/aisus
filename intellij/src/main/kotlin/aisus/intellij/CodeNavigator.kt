// IDE-01: click to code. The cited lines open in the editor and are selected.
package aisus.intellij

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.ScrollType
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.file.Path

object CodeNavigator {
    /** Opens [file] at the 1-based [line], selecting through [endLine]. Callable from any thread. */
    fun open(project: Project, file: Path, line: Int?, endLine: Int?) {
        ApplicationManager.getApplication().invokeLater({
            val fs = LocalFileSystem.getInstance()
            val virtualFile = fs.findFileByNioFile(file) ?: fs.refreshAndFindFileByNioFile(file) ?: return@invokeLater
            val start = (line ?: 1).coerceAtLeast(1)
            val editor = FileEditorManager.getInstance(project)
                .openTextEditor(OpenFileDescriptor(project, virtualFile, start - 1, 0), true) ?: return@invokeLater
            val document = editor.document
            if (line == null || document.lineCount == 0) return@invokeLater
            val first = (start - 1).coerceIn(0, document.lineCount - 1)
            val last = ((endLine ?: start) - 1).coerceIn(first, document.lineCount - 1)
            editor.selectionModel.setSelection(document.getLineStartOffset(first), document.getLineEndOffset(last))
            editor.scrollingModel.scrollToCaret(ScrollType.CENTER)
        }, project.disposed)
    }
}
