import { ProofRequestStatus } from "@/shared/domain/enums/ProofRequestStatus";

type ProofRequestProps = {
  id: string;
  appId: string;
  proofType: string;
  status: ProofRequestStatus;
  result: boolean | null;
  externalRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  validatedAt: Date | null;
};

export class ProofRequest {
  constructor(private props: ProofRequestProps) {}

  get id() {
    return this.props.id;
  }
  get appId() {
    return this.props.appId;
  }
  get proofType() {
    return this.props.proofType;
  }
  get status() {
    return this.props.status;
  }
  get result() {
    return this.props.result;
  }
  get externalRef() {
    return this.props.externalRef;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
  get validatedAt() {
    return this.props.validatedAt;
  }
}
