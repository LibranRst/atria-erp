CREATE TABLE "user_role_guide_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"context_key" varchar(64) NOT NULL,
	"acknowledged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_role_guide_state" ADD CONSTRAINT "user_role_guide_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;