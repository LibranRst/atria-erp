CREATE TABLE "ai_user_preference" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"response_style" varchar(30) DEFAULT 'STANDARD' NOT NULL,
	"primary_focus" varchar(30) DEFAULT 'AUTO' NOT NULL,
	"custom_note" varchar(300),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_user_preference" ADD CONSTRAINT "ai_user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;