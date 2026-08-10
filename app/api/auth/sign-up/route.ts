import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/shared/clients/supabase/admin";
import { Environments } from "@/shared/environments";
import { CreateCompanyUseCase } from "@/modules/company/app/create_company_usecase";
import { handleHttpError } from "@/shared/http/handleHttpError";

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(50),
  cnpj: z.string().length(14).regex(/^\d+$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SignUpSchema.parse(body);
    const admin = getSupabaseAdminClient();

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: parsed.email,
        password: parsed.password,
        email_confirm: true,
      });

    if (authError) {
      if (authError.message.toLowerCase().includes("already registered")) {
        return NextResponse.json(
          { error: "E-mail já cadastrado." },
          { status: 409 }
        );
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error("Unexpected: auth user not returned after creation");
    }
    const userId = authData.user.id;

    try {
      const repo = await Environments.getEnvs().getCompanyRepository();
      const useCase = new CreateCompanyUseCase(repo);
      await useCase.execute({
        authUserId: userId,
        email: parsed.email,
        name: parsed.name,
        documentNumber: parsed.cnpj,
      });
    } catch (companyError) {
      await admin.auth.admin.deleteUser(userId).catch((e) => {
        console.error("[signup] rollback failed — orphaned auth user:", userId, e);
      });
      throw companyError;
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleHttpError(error);
  }
}
