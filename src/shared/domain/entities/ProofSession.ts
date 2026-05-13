import { ProofSessionStatus } from "@/shared/domain/enums/ProofSessionStatus";

type ProofSessionProps = {
  id: string;
  proofRequestId: string;
  hashSessionToken: string;
  verificationPageUrl: string;
  deepLinkUrl: string;
  status: ProofSessionStatus;
  createdAt: Date;
  expiresAt: Date;
  openedAt: Date | null;
  approvedAt: Date | null;
};

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
  get verificationPageUrl() {
    return this.props.verificationPageUrl;
  }
  get deepLinkUrl() {
    return this.props.deepLinkUrl;
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
}
