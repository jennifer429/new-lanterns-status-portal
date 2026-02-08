# Test Credentials

## Partner Admin Accounts

### SRV Admin
- **Email**: `admin@srv.com`
- **Password**: `password123`
- **Client ID**: 2 (SRV)
- **Access**: Can only see SRV organizations
- **Admin URL**: `/org/SRV/admin`

### RadOne Admin
- **Email**: `admin@radone.com`
- **Password**: `password123`
- **Client ID**: 3 (RadOne)
- **Access**: Can only see RadOne organizations
- **Admin URL**: `/org/RadOne/admin`

### New Lantern Platform Admin
- **Email**: Any `@newlantern.ai` email (OAuth)
- **Client ID**: NULL or 1
- **Access**: Can see ALL organizations across all partners
- **Admin URL**: `/org/admin`

## Test Organizations

### SRV Organizations
1. **SRV Test Hospital 1** (slug: `srv-test-1`)
2. **SRV Test Hospital 2** (slug: `srv-test-2`)

### RadOne Organizations
1. **RadOne Test Hospital 1** (slug: `radone-test-1`)
2. **RadOne Test Hospital 2** (slug: `radone-test-2`)

## Known Issues

❌ **Login failing for test accounts** - The bcrypt password hash is not matching. Need to:
1. Verify the auth.login procedure's password comparison logic
2. Recreate test users with correct password hashes
3. Test login flow again

## Next Steps

1. Fix password hashing for test accounts
2. Test SRV admin login → should redirect to `/org/SRV/admin` and show only 2 SRV hospitals
3. Test RadOne admin login → should redirect to `/org/RadOne/admin` and show only 2 RadOne hospitals
4. Verify partner isolation is working correctly
