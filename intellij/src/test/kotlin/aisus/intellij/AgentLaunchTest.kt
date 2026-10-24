// IDE-01: Generate's terminal command for each agent, with the focus quoted for the user's shell.
package aisus.intellij

import org.junit.Assert.assertEquals
import org.junit.Test

class AgentLaunchTest {
    @Test
    fun `each agent gets its skill invocation, Devin after a double dash, and no trailing space without a focus`() {
        assertEquals(listOf("claude", "/aisus-architecture payment flow"), AgentLaunch.argv(Agent.CLAUDE, "  payment flow "))
        assertEquals(listOf("codex", "\$aisus-architecture payment flow"), AgentLaunch.argv(Agent.CODEX, "payment flow"))
        assertEquals(listOf("devin", "--", "/aisus-architecture payment flow"), AgentLaunch.argv(Agent.DEVIN, "payment flow"))
        assertEquals(listOf("claude", "/aisus-architecture"), AgentLaunch.argv(Agent.CLAUDE, "   "))
    }

    @Test
    fun `the command line quotes every word a shell would split or expand`() {
        val argv = AgentLaunch.argv(Agent.CODEX, "Bob's \$HOME; rm -rf /")
        assertEquals("codex '\$aisus-architecture Bob'\\''s \$HOME; rm -rf /'", AgentLaunch.commandLine(argv, powerShell = false))
        assertEquals("codex '\$aisus-architecture Bob''s \$HOME; rm -rf /'", AgentLaunch.commandLine(argv, powerShell = true))
        assertEquals("devin -- /aisus-architecture", AgentLaunch.commandLine(AgentLaunch.argv(Agent.DEVIN, ""), powerShell = false))
    }
}
