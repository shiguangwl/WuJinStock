CREATE TABLE `purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unit_price` real NOT NULL,
	`subtotal` real NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`supplier` text NOT NULL,
	`order_date` integer NOT NULL,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_order_number_unique` ON `purchase_orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `return_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`return_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unit_price` real NOT NULL,
	`subtotal` real NOT NULL,
	FOREIGN KEY (`return_order_id`) REFERENCES `return_orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `return_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`original_order_id` text NOT NULL,
	`order_type` text NOT NULL,
	`return_date` integer NOT NULL,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `return_orders_order_number_unique` ON `return_orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `sales_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sales_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unit_price` real NOT NULL,
	`original_price` real NOT NULL,
	`subtotal` real NOT NULL,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`customer_name` text,
	`order_date` integer NOT NULL,
	`subtotal` real NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`rounding_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_orders_order_number_unique` ON `sales_orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `stock_taking_items` (
	`id` text PRIMARY KEY NOT NULL,
	`stock_taking_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`system_quantity` real NOT NULL,
	`actual_quantity` real NOT NULL,
	`difference` real NOT NULL,
	`unit` text NOT NULL,
	FOREIGN KEY (`stock_taking_id`) REFERENCES `stock_takings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stock_takings` (
	`id` text PRIMARY KEY NOT NULL,
	`taking_date` integer NOT NULL,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
