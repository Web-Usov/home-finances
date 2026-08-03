import { Injectable } from '@nestjs/common';

/**
 * Allocations service — manages monthly income distribution across envelopes.
 * TODO: Implement per SPECIFICATION.md § Income, Distribution and Free Funds (lines 121-131).
 */
@Injectable()
export class AllocationsService {
  save(period: string, dto: unknown) {
    // TODO: validate Σ allocation ≤ income, save allocations, trigger recalculation
    return { period, message: 'Not implemented' };
  }
}
