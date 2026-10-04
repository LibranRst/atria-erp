CREATE TABLE "ai_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_type" varchar(50) NOT NULL,
	"run_by_id" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"payload" text,
	"result" text,
	"error_message" text,
	"tokens_used" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_id" uuid,
	CONSTRAINT "app_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approver_id" uuid NOT NULL,
	"reference_type" varchar(100) NOT NULL,
	"reference_id" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"reference_type" varchar(100) NOT NULL,
	"reference_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_table" varchar(100) NOT NULL,
	"target_id" uuid NOT NULL,
	"original_state" text,
	"new_state" text,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"holder_name" varchar(255) NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bank_account_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "bank_statement_import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"imported_by_id" uuid NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statement_row" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"type" varchar(10) NOT NULL,
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"matched_cash_transaction_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"type" varchar(10) NOT NULL,
	"category" varchar(50) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text NOT NULL,
	"reconciled" boolean DEFAULT false NOT NULL,
	"reconciliation_date" timestamp,
	"reconciled_by_id" uuid,
	"reference_type" varchar(100),
	"reference_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"email" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "client_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"invoice_number" varchar(100) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"status" varchar(50) NOT NULL,
	"stage" varchar(50) NOT NULL,
	"due_date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_invoice_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "client_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_invoice_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"cash_transaction_id" uuid NOT NULL,
	"amount_paid" numeric(15, 2) NOT NULL,
	"payment_date" timestamp NOT NULL,
	"received_by_id" uuid NOT NULL,
	"reference_number" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"severity" varchar(20) DEFAULT 'INFO' NOT NULL,
	"reference_type" varchar(100),
	"reference_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"client_id" uuid NOT NULL,
	"project_manager_id" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"financial_health" varchar(50) DEFAULT 'HEALTHY' NOT NULL,
	"total_contract_value" numeric(15, 2) NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_budget_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_budget_id" uuid NOT NULL,
	"cost_category_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"allocated_amount" numeric(15, 2) NOT NULL,
	"actual_spent" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_cost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"project_budget_item_id" uuid NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text NOT NULL,
	"receipt_image_url" text,
	"status" varchar(50) NOT NULL,
	"budget_overrun" boolean DEFAULT false NOT NULL,
	"bank_account_id" uuid,
	"cash_transaction_id" uuid,
	"verified_by_id" uuid,
	"verified_at" timestamp,
	"approved_by_id" uuid,
	"approved_at" timestamp,
	"paid_by_id" uuid,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_cost_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_cost_category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50) NOT NULL,
	"address" text,
	"bank_name" varchar(100),
	"bank_account_number" varchar(50),
	"bank_account_holder" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor_bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"project_budget_item_id" uuid NOT NULL,
	"bill_number" varchar(100) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"status" varchar(50) NOT NULL,
	"due_date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_bill_bill_number_unique" UNIQUE("bill_number")
);
--> statement-breakpoint
CREATE TABLE "vendor_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_bill_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"cash_transaction_id" uuid,
	"amount_paid" numeric(15, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"payment_date" timestamp NOT NULL,
	"paid_by_id" uuid NOT NULL,
	"reference_number" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_run_by_id_user_id_fk" FOREIGN KEY ("run_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_config" ADD CONSTRAINT "app_config_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval" ADD CONSTRAINT "approval_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_import" ADD CONSTRAINT "bank_statement_import_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_import" ADD CONSTRAINT "bank_statement_import_imported_by_id_user_id_fk" FOREIGN KEY ("imported_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_row" ADD CONSTRAINT "bank_statement_row_import_id_bank_statement_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_statement_import"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_row" ADD CONSTRAINT "bank_statement_row_matched_cash_transaction_id_cash_transaction_id_fk" FOREIGN KEY ("matched_cash_transaction_id") REFERENCES "public"."cash_transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transaction" ADD CONSTRAINT "cash_transaction_reconciled_by_id_user_id_fk" FOREIGN KEY ("reconciled_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invoice" ADD CONSTRAINT "client_invoice_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment" ADD CONSTRAINT "client_payment_client_invoice_id_client_invoice_id_fk" FOREIGN KEY ("client_invoice_id") REFERENCES "public"."client_invoice"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment" ADD CONSTRAINT "client_payment_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment" ADD CONSTRAINT "client_payment_cash_transaction_id_cash_transaction_id_fk" FOREIGN KEY ("cash_transaction_id") REFERENCES "public"."cash_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment" ADD CONSTRAINT "client_payment_received_by_id_user_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_project_manager_id_user_id_fk" FOREIGN KEY ("project_manager_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget" ADD CONSTRAINT "project_budget_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget" ADD CONSTRAINT "project_budget_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_item" ADD CONSTRAINT "project_budget_item_project_budget_id_project_budget_id_fk" FOREIGN KEY ("project_budget_id") REFERENCES "public"."project_budget"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budget_item" ADD CONSTRAINT "project_budget_item_cost_category_id_project_cost_category_id_fk" FOREIGN KEY ("cost_category_id") REFERENCES "public"."project_cost_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_project_budget_item_id_project_budget_item_id_fk" FOREIGN KEY ("project_budget_item_id") REFERENCES "public"."project_budget_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_cash_transaction_id_cash_transaction_id_fk" FOREIGN KEY ("cash_transaction_id") REFERENCES "public"."cash_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_verified_by_id_user_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost" ADD CONSTRAINT "project_cost_paid_by_id_user_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill" ADD CONSTRAINT "vendor_bill_project_budget_item_id_project_budget_item_id_fk" FOREIGN KEY ("project_budget_item_id") REFERENCES "public"."project_budget_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_vendor_bill_id_vendor_bill_id_fk" FOREIGN KEY ("vendor_bill_id") REFERENCES "public"."vendor_bill"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_cash_transaction_id_cash_transaction_id_fk" FOREIGN KEY ("cash_transaction_id") REFERENCES "public"."cash_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment" ADD CONSTRAINT "vendor_payment_paid_by_id_user_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_run_by_id_idx" ON "ai_run" USING btree ("run_by_id");--> statement-breakpoint
CREATE INDEX "app_reference_idx" ON "approval" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "app_approver_id_idx" ON "approval" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX "att_reference_idx" ON "attachment" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "al_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "al_target_idx" ON "audit_log" USING btree ("target_table","target_id");--> statement-breakpoint
CREATE INDEX "bsi_bank_account_id_idx" ON "bank_statement_import" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "bsr_import_id_idx" ON "bank_statement_row" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "bsr_matched_cash_transaction_idx" ON "bank_statement_row" USING btree ("matched_cash_transaction_id");--> statement-breakpoint
CREATE INDEX "ct_bank_account_id_idx" ON "cash_transaction" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "ct_reference_idx" ON "cash_transaction" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "ci_project_id_idx" ON "client_invoice" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "cp_invoice_id_idx" ON "client_payment" USING btree ("client_invoice_id");--> statement-breakpoint
CREATE INDEX "cp_bank_account_id_idx" ON "client_payment" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "cp_cash_transaction_id_idx" ON "client_payment" USING btree ("cash_transaction_id");--> statement-breakpoint
CREATE INDEX "notif_user_id_idx" ON "notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_read_idx" ON "notification" USING btree ("read");--> statement-breakpoint
CREATE INDEX "project_client_id_idx" ON "project" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "project_pm_id_idx" ON "project" USING btree ("project_manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pb_project_id_idx" ON "project_budget" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pbi_project_budget_id_idx" ON "project_budget_item" USING btree ("project_budget_id");--> statement-breakpoint
CREATE INDEX "pbi_cost_category_id_idx" ON "project_budget_item" USING btree ("cost_category_id");--> statement-breakpoint
CREATE INDEX "pc_project_id_idx" ON "project_cost" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pc_project_budget_item_id_idx" ON "project_cost" USING btree ("project_budget_item_id");--> statement-breakpoint
CREATE INDEX "pc_requested_by_id_idx" ON "project_cost" USING btree ("requested_by_id");--> statement-breakpoint
CREATE INDEX "pc_bank_account_id_idx" ON "project_cost" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "pc_cash_transaction_id_idx" ON "project_cost" USING btree ("cash_transaction_id");--> statement-breakpoint
CREATE INDEX "pc_verified_by_id_idx" ON "project_cost" USING btree ("verified_by_id");--> statement-breakpoint
CREATE INDEX "pc_approved_by_id_idx" ON "project_cost" USING btree ("approved_by_id");--> statement-breakpoint
CREATE INDEX "pc_paid_by_id_idx" ON "project_cost" USING btree ("paid_by_id");--> statement-breakpoint
CREATE INDEX "user_role_id_idx" ON "user" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "vb_vendor_id_idx" ON "vendor_bill" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vb_project_id_idx" ON "vendor_bill" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "vb_project_budget_item_id_idx" ON "vendor_bill" USING btree ("project_budget_item_id");--> statement-breakpoint
CREATE INDEX "vp_bill_id_idx" ON "vendor_payment" USING btree ("vendor_bill_id");--> statement-breakpoint
CREATE INDEX "vp_bank_account_id_idx" ON "vendor_payment" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "vp_cash_transaction_id_idx" ON "vendor_payment" USING btree ("cash_transaction_id");