import { configureMarkdownRenderer } from './config.js';
import { bindAttachmentTrayInteractions } from './features/attachments.js';
import { bindComposerEvents } from './features/composer.js';
import { bindChatInteractions, renderEmptyState, resetComposerHeight } from './features/messages.js';
import { bindNavigation } from './features/navigation.js';

configureMarkdownRenderer();
bindAttachmentTrayInteractions();
bindChatInteractions();
bindComposerEvents();
bindNavigation();
resetComposerHeight();
renderEmptyState();
