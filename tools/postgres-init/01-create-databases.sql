-- Create databases for each microservice
CREATE DATABASE gateway_db;
CREATE DATABASE auth_db;
CREATE DATABASE user_db;
CREATE DATABASE vendor_db;
CREATE DATABASE event_db;
CREATE DATABASE booking_db;
CREATE DATABASE notification_db;
CREATE DATABASE analytics_db;
CREATE DATABASE admin_db;

-- Grant privileges to the eventbooking user
GRANT ALL PRIVILEGES ON DATABASE gateway_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE auth_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE user_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE vendor_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE event_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE booking_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE notification_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE analytics_db TO eventbooking;
GRANT ALL PRIVILEGES ON DATABASE admin_db TO eventbooking;