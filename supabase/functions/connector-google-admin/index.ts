import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const payload = await req.json()
    const { action, org_id, device_id } = payload

    async function getCreds() {
      const { data, error } = await sb
        .from('connector_credentials').select('credentials, sync_data')
        .eq('org_id', org_id).eq('connector_id', 'google-admin').single()
      if (error) throw error
      return data
    }

    function gFetch(token: string, path: string, method = 'GET', body?: unknown) {
      return fetch(`https://admin.googleapis.com${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const now = Date.now()
      const org_units = [
        { id:'ou-district',   name:'District Office',        path:'/District Office',                          parent:null,             device_count:24 },
        { id:'ou-hs',         name:'Lincoln High School',    path:'/Lincoln High School',                      parent:null,             device_count:312 },
        { id:'ou-hs-staff',   name:'Staff',                  path:'/Lincoln High School/Staff',                parent:'ou-hs',          device_count:58 },
        { id:'ou-hs-student', name:'Students',               path:'/Lincoln High School/Students',             parent:'ou-hs',          device_count:254 },
        { id:'ou-ms',         name:'Jefferson Middle',       path:'/Jefferson Middle',                         parent:null,             device_count:218 },
        { id:'ou-ms-staff',   name:'Staff',                  path:'/Jefferson Middle/Staff',                   parent:'ou-ms',          device_count:42 },
        { id:'ou-ms-student', name:'Students',               path:'/Jefferson Middle/Students',                parent:'ou-ms',          device_count:176 },
        { id:'ou-es',         name:'Franklin Elementary',    path:'/Franklin Elementary',                      parent:null,             device_count:189 },
        { id:'ou-es-staff',   name:'Staff',                  path:'/Franklin Elementary/Staff',                parent:'ou-es',          device_count:31 },
        { id:'ou-es-student', name:'Students',               path:'/Franklin Elementary/Students',             parent:'ou-es',          device_count:158 },
        { id:'ou-spare',      name:'Spare / Unassigned',     path:'/Spare - Unassigned',                       parent:null,             device_count:37 },
      ]

      const devices = [
        { id:'d001', serial:'5CD1234ABC', asset_tag:'LHS-001', model:'HP Chromebook 11 G9 EE', ou_id:'ou-hs-student', ou_path:'/Lincoln High School/Students', assigned_user:'jsmith@district.edu', status:'ACTIVE', os_version:'114.0.5735.350', last_sync:new Date(now-3600000).toISOString(),  enrolled:new Date('2022-08-15').toISOString(), location:'Lincoln High School', notes:'' },
        { id:'d002', serial:'5CD1235DEF', asset_tag:'LHS-002', model:'HP Chromebook 11 G9 EE', ou_id:'ou-hs-student', ou_path:'/Lincoln High School/Students', assigned_user:'mwilliams@district.edu', status:'ACTIVE', os_version:'114.0.5735.350', last_sync:new Date(now-7200000).toISOString(), enrolled:new Date('2022-08-15').toISOString(), location:'Lincoln High School', notes:'' },
        { id:'d003', serial:'5CD2001XYZ', asset_tag:'LHS-003', model:'Lenovo 100e Chromebook',  ou_id:'ou-hs-student', ou_path:'/Lincoln High School/Students', assigned_user:'',                     status:'DISABLED', os_version:'112.0.5615.165', last_sync:new Date(now-86400000).toISOString(),  enrolled:new Date('2021-08-10').toISOString(), location:'Lincoln High School', notes:'Screen damaged' },
        { id:'d004', serial:'5CD2002QRS', asset_tag:'LHS-S01', model:'HP Chromebook 14 G7',     ou_id:'ou-hs-staff',   ou_path:'/Lincoln High School/Staff',    assigned_user:'dlee@district.edu',    status:'ACTIVE', os_version:'114.0.5735.350', last_sync:new Date(now-1800000).toISOString(),  enrolled:new Date('2023-01-05').toISOString(), location:'Lincoln High School', notes:'' },
        { id:'d005', serial:'5CD3000AAA', asset_tag:'JMS-001', model:'Acer Chromebook 311',     ou_id:'ou-ms-student', ou_path:'/Jefferson Middle/Students',    assigned_user:'rgarcia@district.edu', status:'ACTIVE', os_version:'113.0.5672.231', last_sync:new Date(now-900000).toISOString(),   enrolled:new Date('2022-08-20').toISOString(), location:'Jefferson Middle',   notes:'' },
        { id:'d006', serial:'5CD3001BBB', asset_tag:'JMS-002', model:'Acer Chromebook 311',     ou_id:'ou-ms-student', ou_path:'/Jefferson Middle/Students',    assigned_user:'tchen@district.edu',   status:'ACTIVE', os_version:'113.0.5672.231', last_sync:new Date(now-3600000).toISOString(),  enrolled:new Date('2022-08-20').toISOString(), location:'Jefferson Middle',   notes:'' },
        { id:'d007', serial:'5CD3100CCC', asset_tag:'JMS-S01', model:'HP Chromebook 14 G7',     ou_id:'ou-ms-staff',   ou_path:'/Jefferson Middle/Staff',       assigned_user:'sbrown@district.edu',  status:'ACTIVE', os_version:'114.0.5735.350', last_sync:new Date(now-5400000).toISOString(),  enrolled:new Date('2023-01-10').toISOString(), location:'Jefferson Middle',   notes:'' },
        { id:'d008', serial:'5CD4000DDD', asset_tag:'FES-001', model:'Lenovo 100e Chromebook',  ou_id:'ou-es-student', ou_path:'/Franklin Elementary/Students', assigned_user:'',                     status:'ACTIVE', os_version:'112.0.5615.165', last_sync:new Date(now-10800000).toISOString(), enrolled:new Date('2021-09-01').toISOString(), location:'Franklin Elementary', notes:'' },
        { id:'d009', serial:'5CD4001EEE', asset_tag:'FES-002', model:'Lenovo 100e Chromebook',  ou_id:'ou-es-student', ou_path:'/Franklin Elementary/Students', assigned_user:'',                     status:'DEPROVISIONED', os_version:'110.0.5481.177', last_sync:new Date(now-2592000000).toISOString(), enrolled:new Date('2020-08-20').toISOString(), location:'', notes:'End of life' },
        { id:'d010', serial:'5CD5000FFF', asset_tag:'DO-001',  model:'HP Chromebook 14 G7',     ou_id:'ou-district',   ou_path:'/District Office',              assigned_user:'admin@district.edu',   status:'ACTIVE', os_version:'114.0.5735.350', last_sync:new Date(now-600000).toISOString(),   enrolled:new Date('2023-03-01').toISOString(), location:'District Office',    notes:'' },
        { id:'d011', serial:'5CD9000ZZZ', asset_tag:'SPARE-01',model:'HP Chromebook 11 G9 EE',  ou_id:'ou-spare',      ou_path:'/Spare - Unassigned',           assigned_user:'',                     status:'ACTIVE', os_version:'114.0.5735.350', last_sync:new Date(now-172800000).toISOString(), enrolled:new Date('2022-08-15').toISOString(), location:'',                  notes:'Loaner pool' },
      ]

      const users = [
        { id:'u001', email:'jsmith@district.edu',      name:'Jordan Smith',   type:'student', ou:'/Lincoln High School/Students', last_login:new Date(now-3600000).toISOString(),  suspended:false },
        { id:'u002', email:'mwilliams@district.edu',   name:'Maya Williams',  type:'student', ou:'/Lincoln High School/Students', last_login:new Date(now-7200000).toISOString(),  suspended:false },
        { id:'u003', email:'dlee@district.edu',        name:'Dana Lee',       type:'staff',   ou:'/Lincoln High School/Staff',    last_login:new Date(now-1800000).toISOString(),  suspended:false },
        { id:'u004', email:'rgarcia@district.edu',     name:'Rosa Garcia',    type:'student', ou:'/Jefferson Middle/Students',    last_login:new Date(now-900000).toISOString(),   suspended:false },
        { id:'u005', email:'tchen@district.edu',       name:'Tyler Chen',     type:'student', ou:'/Jefferson Middle/Students',    last_login:new Date(now-3600000).toISOString(),  suspended:false },
        { id:'u006', email:'sbrown@district.edu',      name:'Sarah Brown',    type:'staff',   ou:'/Jefferson Middle/Staff',       last_login:new Date(now-5400000).toISOString(),  suspended:false },
        { id:'u007', email:'admin@district.edu',       name:'IT Admin',       type:'admin',   ou:'/District Office',              last_login:new Date(now-600000).toISOString(),   suspended:false },
      ]

      const policies = [
        { id:'p001', name:'Student Device Policy',      ou:'/Lincoln High School/Students', type:'DEVICE', settings:{ auto_update_enabled:true, forced_reenrollment:true, guest_mode_enabled:false, developer_tools_disabled:true, screen_lock_delay:3 } },
        { id:'p002', name:'Staff Device Policy',        ou:'/Lincoln High School/Staff',    type:'DEVICE', settings:{ auto_update_enabled:true, forced_reenrollment:true, guest_mode_enabled:false, developer_tools_disabled:false, screen_lock_delay:5 } },
        { id:'p003', name:'Elementary Student Policy',  ou:'/Franklin Elementary/Students', type:'DEVICE', settings:{ auto_update_enabled:true, forced_reenrollment:true, guest_mode_enabled:false, developer_tools_disabled:true, screen_lock_delay:1 } },
        { id:'p004', name:'Managed Extensions - All',   ou:'/',                             type:'EXTENSION', settings:{ extensions:['aapocclcgogkmnckokdopfmhonfmgoek','ghbmnnjooekpmoecnnnilnnbdlolhkhi'] } },
      ]

      const settings = {
        domain: 'district.edu',
        enrollment_token_permanent: true,
        allow_non_google_images: false,
        reporting_enabled: true,
        device_user_allowlist: false,
        transfer_token_expire_days: 0,
      }

      const sync_data = { org_units, devices, users, policies, settings, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'google-admin', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    // ── SAVE ──────────────────────────────────────────────────────────────────
    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'google-admin', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }

    // ── SYNC (real Google Admin SDK) ──────────────────────────────────────────
    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      const token = creds.access_token
      if (!token) throw new Error('No OAuth access token stored — re-authorize the connector')

      // Fetch org units
      const ouRes = await gFetch(token, '/admin/directory/v1/customer/my_customer/orgunits?type=all')
      if (!ouRes.ok) throw new Error(`Google OrgUnits API error: ${ouRes.status}`)
      const ouData = await ouRes.json()
      const org_units = (ouData.organizationUnits || []).map((ou: any) => ({
        id: ou.orgUnitId, name: ou.name, path: ou.orgUnitPath, parent: ou.parentOrgUnitId || null, device_count: 0,
      }))

      // Fetch Chrome devices
      const devRes = await gFetch(token, '/admin/directory/v1/customer/my_customer/devices/chromeos?projection=FULL&maxResults=500')
      if (!devRes.ok) throw new Error(`Google ChromeOS devices API error: ${devRes.status}`)
      const devData = await devRes.json()
      const devices = (devData.chromeosdevices || []).map((d: any) => ({
        id: d.deviceId, serial: d.serialNumber, asset_tag: d.annotatedAssetId || '',
        model: d.model, ou_id: d.orgUnitId, ou_path: d.orgUnitPath,
        assigned_user: d.annotatedUser || '', status: d.status,
        os_version: d.osVersion, last_sync: d.lastSync, enrolled: d.enrollmentTime, location: d.annotatedLocation || '', notes: d.notes || '',
      }))
      // Backfill device counts into org_units
      for (const ou of org_units) {
        ou.device_count = devices.filter((d: any) => d.ou_path === ou.path).length
      }

      // Fetch users
      const userRes = await gFetch(token, '/admin/directory/v1/users?customer=my_customer&maxResults=500&projection=basic')
      const userData = userRes.ok ? await userRes.json() : { users: [] }
      const users = (userData.users || []).map((u: any) => ({
        id: u.id, email: u.primaryEmail, name: u.name?.fullName || '',
        type: u.isAdmin ? 'admin' : 'staff', ou: u.orgUnitPath,
        last_login: u.lastLoginTime, suspended: u.suspended,
      }))

      const sync_data = { org_units, devices, users, policies: [], settings: {}, synced_at: new Date().toISOString() }
      await sb.from('connector_credentials')
        .update({ sync_data, last_sync: new Date().toISOString() })
        .eq('org_id', org_id).eq('connector_id', 'google-admin')
      return respond({ ok:true, counts: { devices: devices.length, users: users.length, org_units: org_units.length } })
    }

    // ── LOAD ──────────────────────────────────────────────────────────────────
    if (action === 'load') {
      const { data, error } = await sb
        .from('connector_credentials').select('sync_data, last_sync')
        .eq('org_id', org_id).eq('connector_id', 'google-admin').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    // ── MOVE_OU ───────────────────────────────────────────────────────────────
    if (action === 'move_ou') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: device moved to ' + payload.ou_path })
      const res = await gFetch(creds.access_token, `/admin/directory/v1/customer/my_customer/devices/chromeos/${device_id}/action`, 'POST', { action:'move', orgUnitPath: payload.ou_path })
      if (!res.ok) throw new Error(`Move OU error: ${res.status}`)
      return respond({ ok:true })
    }

    // ── DISABLE ───────────────────────────────────────────────────────────────
    if (action === 'disable') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: device disabled' })
      const res = await gFetch(creds.access_token, `/admin/directory/v1/customer/my_customer/devices/chromeos/${device_id}/action`, 'POST', { action:'disable' })
      if (!res.ok) throw new Error(`Disable error: ${res.status}`)
      return respond({ ok:true })
    }

    // ── DEPROVISION ───────────────────────────────────────────────────────────
    if (action === 'deprovision') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: device deprovisioned' })
      const res = await gFetch(creds.access_token, `/admin/directory/v1/customer/my_customer/devices/chromeos/${device_id}/action`, 'POST', { action:'deprovision', deprovisionReason: payload.reason || 'retiring_device' })
      if (!res.ok) throw new Error(`Deprovision error: ${res.status}`)
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
