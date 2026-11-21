CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`full_name` text NOT NULL,
	`phone` text NOT NULL,
	`line1` text NOT NULL,
	`line2` text,
	`city` text NOT NULL,
	`province` text NOT NULL,
	`postal_code` text NOT NULL,
	`country` text DEFAULT 'PH' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `addresses_user_idx` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before` text,
	`after` text,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`variant_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cart_owner_variant_idx` ON `cart_items` (`owner_key`,`variant_id`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`actor_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text,
	`variant_id` text,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`variant_label` text NOT NULL,
	`image` text,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`user_id` text,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`return_status` text DEFAULT 'none' NOT NULL,
	`return_reason` text,
	`email` text NOT NULL,
	`shipping_address` text NOT NULL,
	`shipping_tier` text DEFAULT 'standard' NOT NULL,
	`payment_method` text NOT NULL,
	`payment_last4` text,
	`subtotal` integer NOT NULL,
	`tier_discount` integer DEFAULT 0 NOT NULL,
	`bundle_discount` integer DEFAULT 0 NOT NULL,
	`promo_discount` integer DEFAULT 0 NOT NULL,
	`shipping_fee` integer NOT NULL,
	`gift_wrap_fee` integer DEFAULT 0 NOT NULL,
	`tax_included` integer NOT NULL,
	`total` integer NOT NULL,
	`refunded_amount` integer DEFAULT 0 NOT NULL,
	`promo_codes` text DEFAULT '[]' NOT NULL,
	`gift_wrap` integer DEFAULT false NOT NULL,
	`gift_note` text,
	`carrier` text,
	`tracking_number` text,
	`eta_from` integer,
	`eta_to` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_idx` ON `orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency_idx` ON `orders` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`sku` text NOT NULL,
	`color` text,
	`color_hex` text,
	`size` text,
	`material` text,
	`price_override` integer,
	`stock` integer DEFAULT 0 NOT NULL,
	`reorder_threshold` integer DEFAULT 5 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variants_sku_idx` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`category` text NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`base_price` integer NOT NULL,
	`compare_at_price` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`tier_pricing` integer DEFAULT false NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`specs` text DEFAULT '{}' NOT NULL,
	`materials` text DEFAULT '' NOT NULL,
	`dimensions` text DEFAULT '' NOT NULL,
	`weight_grams` integer DEFAULT 0 NOT NULL,
	`rating_avg` real DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`sold_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_idx` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE TABLE `promo_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`min_subtotal` integer DEFAULT 0 NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`usage_limit` integer,
	`per_user_limit` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`stackable` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promo_code_idx` ON `promo_codes` (`code`);--> statement-breakpoint
CREATE TABLE `promo_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`promo_id` text NOT NULL,
	`user_id` text,
	`order_id` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`promo_id`) REFERENCES `promo_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `redemptions_promo_idx` ON `promo_redemptions` (`promo_id`);--> statement-breakpoint
CREATE TABLE `restock_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`notified_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restock_variant_email_idx` ON `restock_alerts` (`variant_id`,`email`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text,
	`author_name` text NOT NULL,
	`rating` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reviews_product_idx` ON `reviews` (`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_product_idx` ON `reviews` (`product_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `search_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`result_count` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_query_idx` ON `search_queries` (`query`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_version` integer NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `support_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`topic` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	`admin_role` text,
	`status` text DEFAULT 'active' NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `wishlist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlist_owner_product_idx` ON `wishlist_items` (`owner_key`,`product_id`);