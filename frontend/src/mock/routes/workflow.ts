// Demo API: arizalar (workflow) — shablonlar, arizalar va tasdiqlash zanjiri.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { badRequest, byId, forbidden, notFound, notify, requireRole, route, sortBy, userEmail, type Ctx } from '../core';
import { newId, nowIso, type DemoDb } from '../store';

function resolveApprover(d: DemoDb, employeeId: string, step: any): string | null {
  const emp = byId(d.employees, employeeId);
  switch (step.approverType) {
    case 'SPECIFIC_USER':
      return step.approverUserId;
    case 'ROLE':
      return d.users.find((u) => u.role === step.approverRole && u.isActive)?.id ?? null;
    case 'DIRECT_MANAGER':
      return byId(d.employees, emp?.managerId)?.userId ?? null;
    case 'DEPARTMENT_HEAD': {
      const dept = byId(d.departments, emp?.departmentId);
      return byId(d.employees, dept?.headEmployeeId)?.userId ?? null;
    }
    default:
      return null;
  }
}

const templateSummary = (t: any) => ({ id: t.id, name: t.name, description: t.description, formSchema: t.formSchema, documentBody: t.documentBody, isActive: t.isActive, createdAt: t.createdAt });

function withSummary(d: DemoDb, inst: any) {
  const t = byId(d.workflowTemplates, inst.templateId)!;
  const emp = byId(d.employees, inst.employeeId);
  return { ...inst, template: templateSummary(t), employee: emp ?? null };
}

function instanceDetail(ctx: Ctx, id: string, checkAccess: boolean) {
  const d = ctx.db;
  const inst = byId(d.workflowInstances, id);
  if (!inst) throw notFound('Ariza topilmadi');
  const actions = d.workflowStepActions.filter((a) => a.instanceId === inst.id);
  if (checkAccess && ctx.auth) {
    const { role, userId } = ctx.auth;
    const privileged = role === 'SUPER_ADMIN' || role === 'HR_MANAGER' || role === 'HR_SPECIALIST';
    if (!privileged && inst.initiatorUserId !== userId && !actions.some((a) => a.assignedUserId === userId)) {
      throw forbidden("Bu arizani ko'rish huquqingiz yo'q");
    }
  }
  const t = byId(d.workflowTemplates, inst.templateId)!;
  const steps = sortBy(t.steps, (s: any) => s.order);
  const timeline = steps.map((step: any) => {
    const action = actions.find((a) => a.stepId === step.id);
    return {
      order: step.order,
      stepName: step.name,
      status: action?.status ?? 'PENDING',
      assignedUser: userEmail(d, action?.assignedUserId),
      comment: action?.comment ?? null,
      actedAt: action?.actedAt ?? null,
      isCurrent: step.order === inst.currentStepOrder && inst.status === 'IN_PROGRESS',
    };
  });
  return {
    ...inst,
    template: { ...templateSummary(t), steps },
    employee: byId(d.employees, inst.employeeId) ?? null,
    initiator: userEmail(d, inst.initiatorUserId),
    stepActions: actions.map((a) => ({ ...a, step: t.steps.find((s: any) => s.id === a.stepId), assignedUser: userEmail(d, a.assignedUserId) })),
    timeline,
  };
}

route('GET', '/workflow/templates', (ctx) =>
  sortBy(
    ctx.db.workflowTemplates.filter((t) => t.isActive),
    (t) => t.createdAt,
  ).map((t) => ({ ...t, steps: sortBy(t.steps, (s: any) => s.order) })),
);

route('GET', '/workflow/templates/:id', (ctx) => {
  const t = byId(ctx.db.workflowTemplates, ctx.params.id);
  if (!t) throw notFound('Shablon topilmadi');
  return t;
});

route(
  'POST',
  '/workflow/instances',
  (ctx) => {
    const d = ctx.db;
    const { templateId, employeeId, formData } = ctx.body ?? {};
    const t = d.workflowTemplates.find((x) => x.id === templateId && x.isActive);
    if (!t) throw notFound('Shablon topilmadi yoki faol emas');
    if (!byId(d.employees, employeeId)) throw notFound('Xodim topilmadi');
    const data = formData ?? {};
    for (const f of t.formSchema) {
      if (f.required && (data[f.key] === undefined || data[f.key] === '')) throw badRequest(`"${f.label}" maydoni to'ldirilishi shart`);
    }
    const now = nowIso();
    const inst = {
      id: newId(),
      organizationId: d.organization.id,
      templateId: t.id,
      initiatorUserId: ctx.auth!.userId,
      employeeId,
      formData: data,
      generatedDocument: String(t.documentBody ?? '').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(data[k] ?? '')),
      currentStepOrder: 1,
      status: 'IN_PROGRESS',
      createdAt: now,
      updatedAt: now,
    };
    d.workflowInstances.push(inst);
    for (const step of sortBy(t.steps, (s: any) => s.order)) {
      const assigned = resolveApprover(d, employeeId, step);
      d.workflowStepActions.push({ id: newId(), instanceId: inst.id, stepId: step.id, assignedUserId: assigned, status: 'PENDING', comment: null, actedAt: null, createdAt: now });
      if (step.order === 1) notify(d, assigned, 'REQUEST_SUBMITTED', `${t.name} arizasi tasdiqlash uchun yuborildi`, 'WorkflowInstance', inst.id);
    }
    return instanceDetail(ctx, inst.id, false);
  },
  { status: 201 },
);

route('GET', '/workflow/instances/mine', (ctx) =>
  sortBy(
    ctx.db.workflowInstances.filter((i) => i.initiatorUserId === ctx.auth!.userId),
    (i) => i.createdAt,
    'desc',
  ).map((i) => withSummary(ctx.db, i)),
);

route('GET', '/workflow/instances', (ctx) => {
  requireRole(ctx, 'SUPER_ADMIN', 'HR_MANAGER', 'DEPARTMENT_HEAD');
  const status = ctx.query.status;
  return sortBy(
    ctx.db.workflowInstances.filter((i) => !status || i.status === status),
    (i) => i.createdAt,
    'desc',
  ).map((i) => withSummary(ctx.db, i));
});

route('GET', '/workflow/instances/pending-for-me', (ctx) => {
  const d = ctx.db;
  return d.workflowStepActions
    .filter((a) => {
      if (a.status !== 'PENDING' || a.assignedUserId !== ctx.auth!.userId) return false;
      const inst = byId(d.workflowInstances, a.instanceId);
      if (!inst || inst.status !== 'IN_PROGRESS') return false;
      const step = byId(d.workflowTemplates, inst.templateId)?.steps.find((s: any) => s.id === a.stepId);
      return step?.order === inst.currentStepOrder;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((a) => {
      const inst = byId(d.workflowInstances, a.instanceId)!;
      const step = byId(d.workflowTemplates, inst.templateId)!.steps.find((s: any) => s.id === a.stepId);
      return { ...a, step, instance: withSummary(d, inst) };
    });
});

route('GET', '/workflow/instances/:id', (ctx) => instanceDetail(ctx, ctx.params.id, true));

route('POST', '/workflow/instances/:id/decide', (ctx) => {
  const d = ctx.db;
  const { decision, comment } = ctx.body ?? {};
  if (decision !== 'APPROVED' && decision !== 'REJECTED') throw badRequest("Kiritilgan ma'lumotlar noto'g'ri");
  const inst = byId(d.workflowInstances, ctx.params.id);
  if (!inst) throw notFound('Ariza topilmadi');
  if (inst.status !== 'IN_PROGRESS') throw badRequest('Bu ariza allaqachon yakunlangan');
  const t = byId(d.workflowTemplates, inst.templateId)!;
  const step = t.steps.find((s: any) => s.order === inst.currentStepOrder);
  if (!step) throw badRequest('Joriy bosqich topilmadi');
  const action = d.workflowStepActions.find((a) => a.instanceId === inst.id && a.stepId === step.id);
  if (!action) throw notFound('Bosqich yozuvi topilmadi');
  if (action.assignedUserId && action.assignedUserId !== ctx.auth!.userId) throw forbidden('Bu bosqich sizga tayinlanmagan');
  if (action.status !== 'PENDING') throw badRequest("Bu bosqich allaqachon ko'rib chiqilgan");

  const now = nowIso();
  Object.assign(action, { status: decision, comment: comment || null, actedAt: now, assignedUserId: ctx.auth!.userId });
  inst.updatedAt = now;
  if (decision === 'REJECTED') {
    inst.status = 'REJECTED';
    notify(d, inst.initiatorUserId, 'REQUEST_REJECTED', `${t.name} arizangiz rad etildi`, 'WorkflowInstance', inst.id);
  } else {
    const nextStep = t.steps.find((s: any) => s.order === inst.currentStepOrder + 1);
    if (nextStep) {
      const nextAction = d.workflowStepActions.find((a) => a.instanceId === inst.id && a.stepId === nextStep.id);
      if (nextAction && !nextAction.assignedUserId) nextAction.assignedUserId = resolveApprover(d, inst.employeeId, nextStep);
      inst.currentStepOrder = nextStep.order;
      notify(d, nextAction?.assignedUserId, 'REQUEST_SUBMITTED', `${t.name} arizasi tasdiqlash uchun yuborildi`, 'WorkflowInstance', inst.id);
    } else {
      inst.status = 'APPROVED';
      notify(d, inst.initiatorUserId, 'REQUEST_APPROVED', `${t.name} arizangiz to'liq tasdiqlandi`, 'WorkflowInstance', inst.id);
    }
  }
  return instanceDetail(ctx, inst.id, false);
});
