import { CompanyStatus } from "@/shared/domain/enums/CompanyStatus";

type CompanyProps = {
  id: string;
  name: string;
  documentNumber: string | null;
  email: string;
  status: CompanyStatus;
  createdAt: Date;
};

export class Company {
  private props: CompanyProps;

  constructor(props: CompanyProps) {
    this.props = props;
  }

  get id() {
    return this.props.id;
  }

  get name() {
    return this.props.name;
  }

  get documentNumber() {
    return this.props.documentNumber;
  }

  get email() {
    return this.props.email;
  }

  get status() {
    return this.props.status;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  deactivate() {
    this.props.status = CompanyStatus.INACTIVE;
  }

  activate() {
    this.props.status = CompanyStatus.ACTIVE;
  }
}
