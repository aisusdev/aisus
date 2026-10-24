// IDE-01: Generate runs the user's agent in the IDE terminal with the architecture skill, as the
// extension's terminal mode does: Claude Code and Devin take "/aisus-architecture <focus>", Codex
// "$aisus-architecture <focus>", and Devin gets "--" before the prompt.
package aisus.intellij

enum class Agent(val label: String, val binary: String) {
    CLAUDE("Claude Code", "claude"),
    CODEX("Codex", "codex"),
    DEVIN("Devin", "devin");

    override fun toString(): String = label
}

object AgentLaunch {
    private val PLAIN = Regex("""[A-Za-z0-9_./=:@%+,-]+""")

    /** The skill invocation for [agent], with [focus] after it when there is one. */
    fun prompt(agent: Agent, focus: String): String {
        val skill = (if (agent == Agent.CODEX) "$" else "/") + "aisus-architecture"
        val trimmed = focus.trim()
        return if (trimmed.isEmpty()) skill else "$skill $trimmed"
    }

    fun argv(agent: Agent, focus: String): List<String> = when (agent) {
        Agent.DEVIN -> listOf(agent.binary, "--", prompt(agent, focus))
        else -> listOf(agent.binary, prompt(agent, focus))
    }

    /** [argv] as one line for a POSIX shell, or for PowerShell on Windows. */
    fun commandLine(argv: List<String>, powerShell: Boolean): String =
        argv.joinToString(" ") { word -> if (PLAIN.matches(word)) word else if (powerShell) "'" + word.replace("'", "''") + "'" else "'" + word.replace("'", "'\\''") + "'" }
}
