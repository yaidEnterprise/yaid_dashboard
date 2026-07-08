import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";

type ProofSessionProps = {
  id: string;
  proofRequestId: string;
  hashSessionToken: string;
  challengeNonceHash: string | null;
  challengeCreatedAt: Date | null;
  status: ProofSessionStatus;
  createdAt: Date;
  expiresAt: Date;
  openedAt: Date | null;
  approvedAt: Date | null;
};

const TERMINAL_STATUSES = new Set<ProofSessionStatus>([
  ProofSessionStatus.APPROVED_BY_USER,
  ProofSessionStatus.EXPIRED,
  ProofSessionStatus.CANCELLED,
]);

export class ProofSession {
  constructor(private props: ProofSessionProps) {}

  get id() {
    return this.props.id;
  }
  get proofRequestId() {
    return this.props.proofRequestId;
  }
  get hashSessionToken() {
    return this.props.hashSessionToken;
  }
  get challengeNonceHash() {
    return this.props.challengeNonceHash;
  }
  get challengeCreatedAt() {
    return this.props.challengeCreatedAt;
  }
  get status() {
    return this.props.status;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get expiresAt() {
    return this.props.expiresAt;
  }
  get openedAt() {
    return this.props.openedAt;
  }
  get approvedAt() {
    return this.props.approvedAt;
  }

  markOpened() {
    if (this.props.status !== ProofSessionStatus.WAITING_USER) return;
    this.props.status = ProofSessionStatus.OPENED;
    this.props.openedAt = new Date();
  }

  markExpired(): void {
    if (TERMINAL_STATUSES.has(this.props.status)) return;
    this.props.status = ProofSessionStatus.EXPIRED;
    
  openWithChallenge(nonceHash: string, now: Date) {
    if (this.props.status !== ProofSessionStatus.WAITING_USER) return;
    this.props.status = ProofSessionStatus.OPENED;
    this.props.openedAt = now;
    this.props.challengeNonceHash = nonceHash;
    this.props.challengeCreatedAt = now;
  }
}
