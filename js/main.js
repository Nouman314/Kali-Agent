import { configureMarkdownRenderer } from './config.js';
import { bindAttachmentTrayInteractions } from './features/attachments.js';
import { bindComposerEvents } from './features/composer.js';
import { bindGrammarInteractions } from './features/grammar.js';
import { bindChatInteractions, renderEmptyState, resetComposerHeight } from './features/messages.js';
import { bindNavigation } from './features/navigation.js';
import { bindAgentsInteractions } from './features/agents.js';
import { bindWorkspaceInteractions } from './features/workspace.js';

configureMarkdownRenderer();
bindAttachmentTrayInteractions();
bindChatInteractions();
bindComposerEvents();
bindGrammarInteractions();
bindNavigation();
bindAgentsInteractions();
bindWorkspaceInteractions();
resetComposerHeight();
renderEmptyState();