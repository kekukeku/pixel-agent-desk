const DEFAULT_ROLES = {
  planner: {
    id: 'codex',
    name: 'Codex',
    provider: 'GPT-5.5',
    layer: 'Layer 1',
    type: 'planner'
  },
  executor: {
    id: 'antigravity',
    name: 'Antigravity',
    provider: 'Gemini',
    layer: 'Layer 3',
    type: 'executor'
  },
  reviewer: {
    id: 'grok-build',
    name: 'Grok Build',
    provider: 'Grok',
    layer: 'Layer 2',
    type: 'reviewer'
  }
};

const DEFAULT_LABELS = {
  approved: 'approved-by-reviewer',
  changesRequested: 'changes-requested-by-reviewer',
  rejected: 'rejected-by-reviewer',
  needsReview: 'needs-review',
  needsExecutorWork: 'needs-executor-work',
  operatorReviewRequired: 'operator-review-required'
};

function envNameForRole(role, field) {
  return {
    primary: `AGENT_COWORK_ROLE_${role.toUpperCase()}_${field.toUpperCase()}`,
    secondary: `PIXEL_AGENT_DESK_ROLE_${role.toUpperCase()}_${field.toUpperCase()}`
  };
}

function getRoleConfig(env = process.env) {
  const roles = JSON.parse(JSON.stringify(DEFAULT_ROLES));
  for (const role of Object.keys(roles)) {
    for (const field of ['id', 'name', 'provider', 'layer', 'type']) {
      const keys = envNameForRole(role, field);
      const value = env[keys.primary] || env[keys.secondary];
      if (value) roles[role][field] = value;
    }
  }

  const labels = {
    approved: env.AGENT_COWORK_LABEL_APPROVED || env.PIXEL_AGENT_DESK_LABEL_APPROVED || DEFAULT_LABELS.approved,
    changesRequested: env.AGENT_COWORK_LABEL_CHANGES_REQUESTED || env.PIXEL_AGENT_DESK_LABEL_CHANGES_REQUESTED || DEFAULT_LABELS.changesRequested,
    rejected: env.AGENT_COWORK_LABEL_REJECTED || env.PIXEL_AGENT_DESK_LABEL_REJECTED || DEFAULT_LABELS.rejected,
    needsReview: env.AGENT_COWORK_LABEL_NEEDS_REVIEW || env.PIXEL_AGENT_DESK_LABEL_NEEDS_REVIEW || DEFAULT_LABELS.needsReview,
    needsExecutorWork: env.AGENT_COWORK_LABEL_NEEDS_EXECUTOR_WORK || env.PIXEL_AGENT_DESK_LABEL_NEEDS_EXECUTOR_WORK || DEFAULT_LABELS.needsExecutorWork,
    operatorReviewRequired: env.AGENT_COWORK_LABEL_OPERATOR_REVIEW_REQUIRED || env.PIXEL_AGENT_DESK_LABEL_OPERATOR_REVIEW_REQUIRED || DEFAULT_LABELS.operatorReviewRequired
  };

  return { roles, labels };
}

module.exports = {
  DEFAULT_LABELS,
  DEFAULT_ROLES,
  getRoleConfig
};
