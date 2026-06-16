const fs = require('fs');
const path = require('path');

/**
 * Format the full conversation transcript as a clean, ordered markdown file.
 * @param {Object} sessionData The full session JSON data structure.
 * @returns {string} The markdown content.
 */
function formatTranscriptMarkdown(sessionData) {
  const { sessionId, taskNum, title, startedAt, finishedAt, participants, messages } = sessionData;
  
  let md = `# ${title}\n\n`;
  md += `- **Session ID**: \`${sessionId}\`\n`;
  if (taskNum) {
    md += `- **Linked Task**: \`TASK-${taskNum}\`\n`;
  }
  md += `- **Started At**: \`${startedAt}\`\n`;
  md += `- **Finished At**: \`${finishedAt}\`\n\n`;
  
  md += `## Participants\n\n`;
  participants.forEach(p => {
    md += `- **${p.speakerName}** (\`${p.speakerId}\`): \`${p.role}\`\n`;
  });
  md += `\n`;
  
  md += `## Transcript\n\n`;
  
  const stepOrder = [
    'codex_proposal',
    'grok_advice',
    'antigravity_advice',
    'codex_response',
    'antigravity_final',
    'grok_final',
    'codex_closing'
  ];
  
  const sortedMessages = [...messages].sort((a, b) => {
    return stepOrder.indexOf(a.stepId) - stepOrder.indexOf(b.stepId);
  });
  
  sortedMessages.forEach(m => {
    const speaker = participants.find(p => p.speakerId === m.speakerId) || { speakerName: m.speakerId };
    md += `### [${speaker.speakerName}] Step: \`${m.stepId}\`\n\n`;
    md += `${m.content}\n\n`;
  });
  
  return md;
}

/**
 * Format the draft plan from the closing message of the planner (小C).
 * @param {Object} sessionData The full session JSON data structure.
 * @returns {string} The markdown content.
 */
function formatDraftMarkdown(sessionData) {
  const closingMessage = sessionData.messages.find(m => m.stepId === 'codex_closing');
  const content = closingMessage ? closingMessage.content : 'No final plan recorded.';
  
  let md = `# Draft Plan for Session ${sessionData.sessionId}\n\n`;
  if (sessionData.taskNum) {
    md += `- **Linked Task**: \`TASK-${sessionData.taskNum}\`\n\n`;
  }
  md += `## Final Plan Proposal\n\n`;
  md += `${content}\n`;
  return md;
}

module.exports = {
  formatTranscriptMarkdown,
  formatDraftMarkdown
};
