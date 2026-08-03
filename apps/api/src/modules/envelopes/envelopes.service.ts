import { Injectable } from '@nestjs/common';

/**
 * Envelopes service — manages envelope lifecycle, naming, ordering, archiving.
 * TODO: Implement per SPECIFICATION.md § Envelope Management (lines 263-296).
 */
@Injectable()
export class EnvelopesService {
  list() {
    // TODO: return all envelopes with current balances
    return { envelopes: [] };
  }

  create(dto: unknown) {
    // TODO: validate unique name (case-insensitive), create envelope, optional initial balance
    return { envelope: null, message: 'Not implemented' };
  }

  update(id: string, dto: unknown) {
    // TODO: rename or reorder, no financial recalculation needed
    return { id, message: 'Not implemented' };
  }

  archive(id: string) {
    // TODO: validate balance is zero, mark as archived
    return { id, status: 'archived', message: 'Not implemented' };
  }
}
