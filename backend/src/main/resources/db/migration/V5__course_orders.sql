CREATE TABLE course_orders (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL REFERENCES courses(id),
    course_slug VARCHAR(120) NOT NULL,
    course_title VARCHAR(160) NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    access_days INTEGER NOT NULL CHECK (access_days > 0),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELED')),
    buyer_name VARCHAR(80) NOT NULL,
    buyer_email VARCHAR(254) NOT NULL,
    access_token_hash VARCHAR(64) NOT NULL,
    payment_key VARCHAR(200) UNIQUE,
    consent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason VARCHAR(200)
);

CREATE INDEX course_orders_created_idx ON course_orders(created_at DESC);
CREATE INDEX course_orders_course_idx ON course_orders(course_id);

CREATE TABLE course_lesson_progress (
    order_id VARCHAR(36) NOT NULL REFERENCES course_orders(id) ON DELETE CASCADE,
    lesson_id VARCHAR(80) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (order_id, lesson_id)
);
