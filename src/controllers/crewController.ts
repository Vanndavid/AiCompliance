import { Request, Response } from 'express';
import { getRequestUserId } from '../utils/authUtils';
import { isHttpError } from '../utils/httpError';
import { parsePositiveInt } from '../utils/numberUtils';
import { EXPIRING_THIS_WEEK_DAYS } from '../utils/opsStatus';
import {
  listCrewForProject,
  updateCrewMemberEmail,
} from '../services/crewService';
import { sendReminderForCrewMember } from '../services/reminderService';
import { getProjectForUser } from '../services/projectService';

export const getCrew = async (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const projectId = parsePositiveInt(req.query.projectId, 0);
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const project = await getProjectForUser(userId, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const expiringWithinDays = parsePositiveInt(
      req.query.expiringWithinDays,
      EXPIRING_THIS_WEEK_DAYS,
    );
    const result = await listCrewForProject(userId, projectId, expiringWithinDays);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch crew' });
  }
};

export const patchCrewMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Crew member id is required' });
    }

    const userId = getRequestUserId(req);
    const email = typeof req.body?.email === 'string' || req.body?.email === null
      ? req.body.email
      : undefined;
    if (email === undefined) {
      return res.status(400).json({ error: 'email is required' });
    }

    const member = await updateCrewMemberEmail(id, userId, email);
    res.json({
      id: member.id,
      name: member.name,
      email: member.email,
    });
  } catch (error) {
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update crew member' });
  }
};

export const remindCrewMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Crew member id is required' });
    }

    const userId = getRequestUserId(req);
    const documentId = typeof req.body?.documentId === 'string' ? req.body.documentId : undefined;
    const result = await sendReminderForCrewMember(id, userId, documentId);
    res.json({ success: true, ...result });
  } catch (error) {
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
};
