CREATE TABLE "ai_proposal_confirmation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_call_id" varchar(128) NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"proposal_type" varchar(50) NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_proposal_confirmation_tool_call_id_unique" UNIQUE("tool_call_id")
);
--> statement-breakpoint
ALTER TABLE "ai_proposal_confirmation" ADD CONSTRAINT "ai_proposal_confirmation_conversation_id_ai_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposal_confirmation" ADD CONSTRAINT "ai_proposal_confirmation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_proposal_conversation_id_idx" ON "ai_proposal_confirmation" USING btree ("conversation_id");