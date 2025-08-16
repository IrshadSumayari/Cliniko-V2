# Appointment Types Implementation Summary

## Overview
This document summarizes the implementation of appointment types functionality for the PMS integration system. The implementation allows the system to fetch, process, and store appointment types from various PMS providers (Cliniko, Halaxy, Nookal) and filter them based on EPC (Enhanced Primary Care) and WC (Workers Compensation) criteria.

## Requirements Implemented

### 1. Appointment Types Table
- **Table Name**: `appointment_types`
- **Columns**:
  - `id` (UUID, Primary Key)
  - `user_id` (UUID, Foreign Key to users table)
  - `appointment_id` (TEXT, PMS appointment type ID)
  - `appointment_name` (TEXT, Name from PMS)
  - `code` (TEXT, EPC or WC extracted from name)
  - `pms_type` (TEXT, PMS provider type)
  - `created_at` (TIMESTAMP)
  - `updated_at` (TIMESTAMP)

### 2. API Integration
- **Cliniko**: Fetches from `/appointment_types` endpoint
- **Halaxy**: Fetches from `/appointment-types` endpoint  
- **Nookal**: Fetches from `/getAppointmentTypes` endpoint

### 3. Filtering Logic
Only appointment types where the name starts with EPC or WC (case-insensitive) are saved:
- **EPC**: Enhanced Primary Care, Medicare-related appointments
- **WC**: Workers Compensation, WorkCover, Work Injury appointments

## Files Modified

### 1. `lib/pms/types.ts`
- Added `AppointmentType` interface
- Updated `PMSApiInterface` to include:
  - `getAppointmentTypes(): Promise<any[]>`
  - `processAppointmentTypes(appointmentTypes: any[]): AppointmentType[]`

### 2. `lib/supabase/server-admin.ts`
- Added `storeAppointmentTypes()` function to handle database operations
- Clears existing appointment types before inserting new ones
- Handles encryption and database errors

### 3. `lib/pms/cliniko-api.ts`
- Implemented `getAppointmentTypes()` method
- Implemented `processAppointmentTypes()` method
- Added `extractCodeFromName()` helper method

### 4. `lib/pms/halaxy-api.ts`
- Implemented `getAppointmentTypes()` method
- Implemented `processAppointmentTypes()` method
- Added `extractCodeFromName()` helper method

### 5. `lib/pms/nookal-api.ts`
- Implemented `getAppointmentTypes()` method
- Implemented `processAppointmentTypes()` method
- Added `extractCodeFromName()` helper method

### 6. `app/api/pms/connect-and-sync/route.ts`
- Integrated appointment types fetching during PMS connection
- Added appointment types count to sync results
- Enhanced error handling for appointment types operations

## Database Schema

The `appointment_types` table is created with the following SQL:

```sql
CREATE TABLE IF NOT EXISTS appointment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id TEXT NOT NULL,
    appointment_name TEXT NOT NULL,
    code TEXT,
    pms_type TEXT NOT NULL DEFAULT 'cliniko',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, appointment_id, pms_type)
);
```

## Workflow

### 1. PMS Connection
1. User provides PMS credentials
2. System validates credentials and tests connection
3. System fetches appointment types from PMS API
4. System processes and filters appointment types (EPC/WC only)
5. System stores filtered appointment types in database
6. System proceeds with patient and appointment sync

### 2. Appointment Types Processing
1. Fetch all appointment types from PMS
2. Filter by name patterns:
   - EPC: "epc", "enhanced primary care", "medicare"
   - WC: "wc", "workers comp", "workcover", "work injury"
3. Extract codes and store in database
4. Clear existing appointment types for user/PMS combination
5. Insert new filtered appointment types

## Error Handling

- Appointment types errors don't fail the entire sync process
- Database errors are logged and thrown with descriptive messages
- API errors are logged and handled gracefully
- Missing appointment types are logged as warnings

## Benefits

1. **Data Quality**: Only relevant appointment types (EPC/WC) are stored
2. **Performance**: Reduces unnecessary data processing
3. **Compliance**: Ensures only Medicare and Workers Comp appointments are tracked
4. **Scalability**: Works with multiple PMS providers
5. **Maintainability**: Centralized filtering logic across all PMS types

## Future Enhancements

1. **Custom Filtering**: Allow users to define custom appointment type filters
2. **Batch Processing**: Process appointment types in batches for large datasets
3. **Caching**: Implement caching for frequently accessed appointment types
4. **Analytics**: Track appointment type usage patterns
5. **Validation**: Add validation for appointment type data integrity

## Testing

The implementation includes comprehensive error handling and logging. The appointment types processing logic has been tested with mock data to ensure correct filtering of EPC and WC appointment types.

## Security

- Row Level Security (RLS) enabled on appointment_types table
- Users can only access their own appointment types
- API keys are encrypted before storage
- Proper authentication and authorization checks

## Monitoring

- Comprehensive logging for debugging and monitoring
- Error tracking and reporting
- Performance metrics for appointment types operations
- Sync status tracking with appointment types count
