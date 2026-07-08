import { CompanyAppEnvironment } from "@/shared/domain/enums/CompanyAppEnvironment";
import { CompanyAppStatus } from "@/shared/domain/enums/CompanyAppStatus";

type CompanyAppProps = {
  id: string;
  appId: string;
  companyId: string;
  name: string;
  apiKeyHash: string;
  webhookUrl: string;
  environment: CompanyAppEnvironment;
  status: CompanyAppStatus;
  createdAt: Date;
};

export class CompanyApp {
  private props: CompanyAppProps;

  constructor(props: CompanyAppProps) {
    this.props = props;
  }

  get id() {
    return this.props.id;
  }
  get appId() {
    return this.props.appId;
  }
  get companyId() {
    return this.props.companyId;
  }
  get name() {
    return this.props.name;
  }
  get apiKeyHash() {
    return this.props.apiKeyHash;
  }
  get webhookUrl() {
    return this.props.webhookUrl;
  }
  get environment() {
    return this.props.environment;
  }
  get status() {
    return this.props.status;
  }
  get createdAt() {
    return this.props.createdAt;
  }

  rename(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("name cannot be empty");
    this.props.name = trimmed;
  }

  updateWebhook(url: string) {
    this.props.webhookUrl = url.trim();
  }

  setStatus(status: CompanyAppStatus) {
    this.props.status = status;
  }
}
