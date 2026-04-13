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
- **Client ID**: 1 (RadOne)
- **Access**: Can only see RadOne organizations
- **Admin URL**: `/org/RadOne/admin`

### New Lantern Platform Admin
- **Email**: Any `@newlantern.ai` email (OAuth)
- **Client ID**: NULL (platform-level, no partner restriction)
- **Access**: Can see ALL organizations across all partners
- **Admin URL**: `/org/admin`

## Test Organizations

### SRV Organizations
1. **SRV Test Hospital 1** (slug: `srv-test-1`)
2. **SRV Test Hospital 2** (slug: `srv-test-2`)

### RadOne Organizations
1. **RadOne Test Hospital 1** (slug: `radone-test-1`)
2. **RadOne Test Hospital 2** (slug: `radone-test-2`)

## Notes

- Test accounts use email/password login via `/login`
- Platform admin accounts use OAuth login
- If test account login fails, verify the password hash in the database matches `password123` hashed with bcrypt (salt rounds = 10)
