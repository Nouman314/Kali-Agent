import { dom } from '../dom.js';
import { state } from '../state.js';
import { resetChatSession } from '../services/chatApi.js';
import { renderEmptyState } from './messages.js';
import { goToChat } from './navigation.js';

let agentsBound = false;

const PRESET_AGENTS = [
    {
        id: 'kali_helper',
        name: 'Kali Helper',
        description: 'Generate, explain, and debug commands for tools like Nmap, Metasploit, Hydra, Dirb, and Wireshark.',
        systemInstruction: 'You are Kali Command Helper, a specialized cyber security assistant built into Kali Linux. Your job is to help users generate, explain, debug, and troubleshoot command line arguments for security tools like nmap, metasploit, hydra, dirb, wireshark, gobuster, sqlmap, hashcat, etc. Be extremely technical, precise, and output clean code blocks.',
        icon: 'terminal',
        custom: false
    },
    {
        id: 'sec_auditor',
        name: 'Security Auditor',
        description: 'Audit source code, server configurations, and reports to pinpoint security vulnerabilities and remediations.',
        systemInstruction: 'You are Security Auditor, a security analyst assistant. Inspect the user\'s provided source code, config files, network reports, or log snippets to identify security issues, potential exploits, insecure configurations, and missing patches. Suggest specific, actionable remediations.',
        icon: 'shield',
        custom: false
    },
    {
        id: 'network_guide',
        name: 'Network Specialist',
        description: 'Help analyze network scan discoveries, PCAP events, firewall configurations, and routing tables.',
        systemInstruction: 'You are Network Specialist, a network engineer and forensic analyst. Explain networking protocols, assist with packet analysis using Wireshark output, analyze routing/firewall rules, and explain network scanning results.',
        icon: 'radar',
        custom: false
    },
    {
        id: 'log_analyzer',
        name: 'Log Inspector',
        description: 'Deep-dive into syslogs, auth logs, Nginx/Apache logs, and Windows event logs to identify threats.',
        systemInstruction: 'You are Log Inspector. Help parse, filter, and inspect logs (e.g., auth.log, syslog, access.log, event logs) to detect attack patterns, brute-force indicators, privilege escalations, and scan attempts.',
        icon: 'search',
        custom: false
    },
    {
        id: 'malware_analyst',
        name: 'Malware Analyst',
        description: 'Analyze suspicious files, detect payloads, reverse-engineer malicious code behavior, and identify IOCs.',
        systemInstruction: 'You are Malware Analyst, specializing in malware reverse engineering and static/dynamic analysis. When presented with suspicious files, code snippets, or behaviors, identify indicators of compromise (IOCs), explain payload mechanics, suggest sandboxing approaches, and provide YARA rule guidance. Be thorough, technical, and reference MITRE ATT&CK tactics where applicable.',
        icon: 'shield',
        custom: false
    },
    {
        id: 'web_pentester',
        name: 'Web Pentester',
        description: 'Test web applications for XSS, SQLi, CSRF, auth flaws, and provide OWASP-compliant remediation guidance.',
        systemInstruction: 'You are Web Pentester, focused on application security testing. Identify vulnerabilities such as XSS, SQL injection, CSRF, broken authentication, SSRF, and insecure deserialization. Provide OWASP Top 10 aligned findings with proof-of-concept payloads and step-by-step remediation guidance. Always remind users to only test environments they own or have explicit written permission to test.',
        icon: 'code',
        custom: false
    },
    {
        id: 'osint_investigator',
        name: 'OSINT Investigator',
        description: 'Research domains, IPs, emails, social media, and gather intelligence for reconnaissance operations.',
        systemInstruction: 'You are OSINT Investigator, specializing in open-source intelligence gathering. Help users research domains, IP addresses, email addresses, usernames, social media profiles, and public records. Suggest tools and techniques for passive reconnaissance, metadata extraction, and correlation analysis. Emphasize ethical boundaries and legal compliance for all OSINT activities.',
        icon: 'search',
        custom: false
    },
    {
        id: 'crypto_cracker',
        name: 'Crypto Cracker',
        description: 'Analyze hashes, crack password hashes, explain encryption methods, and assist with CTF crypto challenges.',
        systemInstruction: 'You are Crypto Cracker, specializing in cryptography and cryptanalysis. Help identify hash types (MD5, SHA variants, bcrypt, NTLM, etc.), explain encryption/decryption methods, and assist with password cracking strategies using tools like Hashcat or John the Ripper. Support CTF participants with crypto challenge walkthroughs. Always clarify legal and ethical constraints around hash cracking.',
        icon: 'terminal',
        custom: false
    }
];

const ICONS = {
    terminal: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>`,
    shield: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>`,
    radar: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
        </svg>`,
    search: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>`,
    code: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
        </svg>`
};

function getCustomAgents() {
    try {
        const stored = localStorage.getItem('kali_custom_agents');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveCustomAgents(agents) {
    try {
        localStorage.setItem('kali_custom_agents', JSON.stringify(agents));
    } catch (e) {
        console.error('Failed to save custom agents to localStorage:', e);
    }
}

function getIconSvg(name) {
    return ICONS[name] || ICONS.terminal;
}

export function renderAgents() {
    if (!dom.agentsGrid) return;

    const customAgents = getCustomAgents();
    const allAgents = [...PRESET_AGENTS, ...customAgents];
    const searchQuery = dom.agentsSearch?.value.toLowerCase().trim() || '';

    dom.agentsGrid.innerHTML = '';

    const filteredAgents = allAgents.filter(agent => 
        agent.name.toLowerCase().includes(searchQuery) || 
        agent.description.toLowerCase().includes(searchQuery)
    );

    if (filteredAgents.length === 0) {
        dom.agentsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #6b7280; padding: 40px 0; font-size: 13.5px;">
                No agents found matching "${searchQuery}"
            </div>`;
        return;
    }

    filteredAgents.forEach(agent => {
        const isActive = state.activeAgent && state.activeAgent.id === agent.id;
        const card = document.createElement('div');
        card.className = `agent-card ${isActive ? 'is-active' : ''}`;
        card.dataset.agentId = agent.id;

        card.innerHTML = `
            <div class="agent-card-header">
                <div class="agent-card-icon-wrapper ${agent.icon}">
                    ${getIconSvg(agent.icon)}
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    ${agent.custom ? '<span class="agent-card-badge badge-custom">Custom</span>' : ''}
                    ${isActive ? '<span class="agent-card-badge badge-active">Active</span>' : ''}
                </div>
            </div>
            <div class="agent-card-title">${escapeHtml(agent.name)}</div>
            <div class="agent-card-description">${escapeHtml(agent.description)}</div>
            <div class="agent-card-footer">
                ${agent.custom ? `
                    <button class="agent-card-delete-btn" title="Delete Agent" aria-label="Delete Agent">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>` : ''}
                <button class="agent-card-action-btn">${isActive ? 'Deactivate' : 'Activate'}</button>
            </div>
        `;

        // Attach event listeners to card elements
        const actionBtn = card.querySelector('.agent-card-action-btn');
        actionBtn.addEventListener('click', () => {
            if (isActive) {
                deactivateAgent();
            } else {
                activateAgent(agent);
            }
        });

        const deleteBtn = card.querySelector('.agent-card-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteConfirm(card, agent.id);
            });
        }

        dom.agentsGrid.appendChild(card);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function activateAgent(agent) {
    state.activeAgent = {
        id: agent.id,
        name: agent.name,
        systemInstruction: agent.systemInstruction,
        icon: agent.icon
    };

    // Update active badge in chat header
    if (dom.activeAgentBadge) {
        const badgeName = dom.activeAgentBadge.querySelector('.agent-badge-name');
        if (badgeName) {
            badgeName.textContent = agent.name;
        }

        // Insert / update agent icon inside the badge
        const oldIconSvg = dom.activeAgentBadge.querySelector('.agent-badge-icon');
        if (oldIconSvg) oldIconSvg.remove();

        const parser = new DOMParser();
        const doc = parser.parseFromString(getIconSvg(agent.icon), 'image/svg+xml');
        const iconSvg = doc.documentElement;
        iconSvg.classList.add('agent-badge-icon');
        iconSvg.style.width = '13px';
        iconSvg.style.height = '13px';
        iconSvg.style.marginRight = '2px';
        dom.activeAgentBadge.insertBefore(iconSvg, badgeName);

        dom.activeAgentBadge.style.display = 'inline-flex';
    }

    // Reset Chat session to clear context and apply new system instructions
    resetChatSession().then(() => {
        if (dom.chatArea) {
            dom.chatArea.innerHTML = '';
            renderEmptyState();
        }
    });

    renderAgents();
    goToChat();
}

export function deactivateAgent() {
    state.activeAgent = null;

    if (dom.activeAgentBadge) {
        dom.activeAgentBadge.style.display = 'none';
    }

    resetChatSession().then(() => {
        if (dom.chatArea) {
            dom.chatArea.innerHTML = '';
            renderEmptyState();
        }
    });

    renderAgents();
}

function showDeleteConfirm(card, agentId) {
    const agent = PRESET_AGENTS.find(a => a.id === agentId) || getCustomAgents().find(a => a.id === agentId);
    const name = agent ? agent.name : 'this agent';

    const modal = document.getElementById('deleteConfirmModal');
    const nameEl = document.getElementById('deleteAgentName');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtns = document.querySelectorAll('#cancelDeleteBtn, #cancelDeleteBtn2');

    if (!modal) return;
    nameEl.textContent = name;
    modal.classList.add('is-visible');

    function cleanup() {
        modal.classList.remove('is-visible');
    }

    function onConfirm() {
        cleanup();
        deleteAgent(agentId);
    }

    function onCancel() {
        cleanup();
    }

    confirmBtn.addEventListener('click', onConfirm, { once: true });
    cancelBtns.forEach(btn => btn.addEventListener('click', onCancel, { once: true }));

    modal.addEventListener('click', function handler(e) {
        if (e.target === modal) {
            cleanup();
            modal.removeEventListener('click', handler);
        }
    });
}

function deleteAgent(id) {
    const customAgents = getCustomAgents();
    const filtered = customAgents.filter(a => a.id !== id);
    saveCustomAgents(filtered);

    if (state.activeAgent && state.activeAgent.id === id) {
        deactivateAgent();
    } else {
        renderAgents();
    }
}

function openModal() {
    if (!dom.agentModal) return;
    dom.agentModal.classList.add('is-visible');
    dom.customAgentName?.focus();
}

function closeModal() {
    if (!dom.agentModal || !dom.agentModalForm) return;
    dom.agentModal.classList.remove('is-visible');
    dom.agentModalForm.reset();

    // Reset selected icon
    const options = dom.customAgentIconSelector?.querySelectorAll('.icon-option');
    options?.forEach((opt, idx) => {
        opt.classList.toggle('is-selected', idx === 0);
    });
}

export function bindAgentsInteractions() {
    if (agentsBound) return;
    agentsBound = true;

    // Search input
    dom.agentsSearch?.addEventListener('input', () => {
        renderAgents();
    });

    // Create btn
    dom.createAgentBtn?.addEventListener('click', openModal);

    // Cancel / Close btns
    dom.closeAgentModalBtn?.addEventListener('click', closeModal);
    dom.cancelAgentBtn?.addEventListener('click', closeModal);

    // Click outside modal
    dom.agentModal?.addEventListener('click', (e) => {
        if (e.target === dom.agentModal) {
            closeModal();
        }
    });

    // Icon selector buttons
    const iconOptions = dom.customAgentIconSelector?.querySelectorAll('.icon-option');
    iconOptions?.forEach(opt => {
        opt.addEventListener('click', () => {
            iconOptions.forEach(o => o.classList.remove('is-selected'));
            opt.classList.add('is-selected');
        });
    });

    // Preset template buttons
    const presetBtns = dom.agentModal?.querySelectorAll('.preset-template-btn');
    presetBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
            const presetId = btn.getAttribute('data-preset');
            const preset = PRESET_AGENTS.find(a => a.id === presetId);
            if (!preset) return;

            dom.customAgentName.value = preset.name;
            dom.customAgentDesc.value = preset.description;
            dom.customAgentPrompt.value = preset.systemInstruction;

            const iconOptions = dom.customAgentIconSelector?.querySelectorAll('.icon-option');
            iconOptions?.forEach(opt => {
                opt.classList.toggle('is-selected', opt.getAttribute('data-icon') === preset.icon);
            });
        });
    });

    // Form submit
    dom.agentModalForm?.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = dom.customAgentName?.value.trim();
        const description = dom.customAgentDesc?.value.trim();
        const systemInstruction = dom.customAgentPrompt?.value.trim();

        const selectedIconOpt = dom.customAgentIconSelector?.querySelector('.icon-option.is-selected');
        const icon = selectedIconOpt ? selectedIconOpt.getAttribute('data-icon') : 'terminal';

        if (!name || !description || !systemInstruction) return;

        const newAgent = {
            id: `custom_${Date.now()}`,
            name,
            description,
            systemInstruction,
            icon,
            custom: true
        };

        const customAgents = getCustomAgents();
        customAgents.push(newAgent);
        saveCustomAgents(customAgents);

        closeModal();
        renderAgents();
    });

    // Clear active agent badge in Chat view
    dom.clearActiveAgentBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        deactivateAgent();
    });

    // Initialize list
    renderAgents();
}
