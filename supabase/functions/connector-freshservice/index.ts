import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const FS_STATUS: Record<number, string> = { 2:'Open', 3:'Pending', 4:'Resolved', 5:'Closed', 6:'Waiting on Customer', 7:'Waiting on Third Party' }
const FS_PRIORITY: Record<number, string> = { 1:'Low', 2:'Medium', 3:'High', 4:'Urgent' }

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
    const { action, org_id, ticket_id } = payload

    async function getCreds() {
      const { data, error } = await sb.from('connector_credentials').select('credentials, sync_data').eq('org_id', org_id).eq('connector_id', 'freshservice').single()
      if (error) throw error
      return data
    }

    function fsFetch(creds: any, path: string, method = 'GET', body?: unknown) {
      return fetch(`https://${creds.domain}/api/v2${path}`, {
        method,
        headers: { Authorization: 'Basic ' + btoa(`${creds.key}:X`), 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const now = Date.now()
      const groups = [
        { id:'grp1', name:'Lincoln High School',  abbr:'LHS', ticket_count:18 },
        { id:'grp2', name:'Jefferson Middle',     abbr:'JMS', ticket_count:11 },
        { id:'grp3', name:'Franklin Elementary',  abbr:'FES', ticket_count:8  },
        { id:'grp4', name:'District Office',      abbr:'DO',  ticket_count:7  },
      ]
      const mock_notes: Record<string, any[]> = {
        'fs-1001': [
          { id:'cn101', author:'Sarah Johnson', created:new Date(now-3600000).toISOString(), private:false, body:'Checked the device. Screen cracked top-right. Ordered replacement screen from inventory — ETA 2 days.' },
          { id:'cn102', author:'System',        created:new Date(now-7200000).toISOString(), private:true,  body:'Ticket auto-routed to IT Hardware group based on category.' },
        ],
        'fs-1007': [
          { id:'cn701', author:'Sarah Johnson', created:new Date(now-1800000).toISOString(), private:false, body:'On-site. Closet B switch cycling every 90 seconds. Likely PSU failure. Ordered Cisco SG350-28 from vendor.' },
          { id:'cn702', author:'Dana Lee',      created:new Date(now-900000).toISOString(),  private:false, body:'Deployed spare 24-port switch from storage. Network restored at 2:34 PM. Ticket stays open pending permanent replacement.' },
        ],
      }
      const tickets = [
        { id:'fs-1001', display_id:1001, subject:'Laptop screen cracked',               description:'Student dropped device during lunch, screen cracked',    requester:'Jordan Smith',  requester_email:'jsmith@district.edu',  group_id:'grp1', group_name:'Lincoln High School',  assignee:'Sarah Johnson',  status:'Open',     priority:'High',   category:'Hardware', item:'Chromebook',  created:new Date(now-7200000).toISOString(),   updated:new Date(now-3600000).toISOString(),   due:new Date(now+57600000).toISOString()  },
        { id:'fs-1002', display_id:1002, subject:'Projector HDMI issue — Room 204',      description:'No signal when connecting laptop to projector',           requester:'Dana Lee',      requester_email:'dlee@district.edu',    group_id:'grp1', group_name:'Lincoln High School',  assignee:'Mike Torres',    status:'In Progress', priority:'Medium', category:'AV',      item:'Projector',   created:new Date(now-18000000).toISOString(), updated:new Date(now-7200000).toISOString(),   due:new Date(now+108000000).toISOString() },
        { id:'fs-1003', display_id:1003, subject:'4 iPads not charging in Room 208',     description:'Class set cart, 4 iPads will not take a charge',          requester:'Sarah Brown',   requester_email:'sbrown@district.edu',  group_id:'grp2', group_name:'Jefferson Middle',     assignee:'Sarah Johnson',  status:'Open',     priority:'High',   category:'Hardware', item:'iPad',        created:new Date(now-3600000).toISOString(),   updated:new Date(now-3600000).toISOString(),   due:new Date(now+72000000).toISOString()  },
        { id:'fs-1004', display_id:1004, subject:'Student locked out of Google account', description:'Google account shows suspended, student cannot log in',    requester:'Sarah Brown',   requester_email:'sbrown@district.edu',  group_id:'grp2', group_name:'Jefferson Middle',     assignee:'Dana Lee',       status:'Pending',  priority:'Medium', category:'Account', item:'Google Workspace', created:new Date(now-86400000).toISOString(), updated:new Date(now-43200000).toISOString(), due:new Date(now+36000000).toISOString() },
        { id:'fs-1005', display_id:1005, subject:'Chromebook keyboard keys stuck',       description:'Keys W and S unresponsive, device FES-012',               requester:'P. Jones',      requester_email:'pjones@district.edu',  group_id:'grp3', group_name:'Franklin Elementary',  assignee:'Mike Torres',    status:'Open',     priority:'Low',    category:'Hardware', item:'Chromebook',  created:new Date(now-172800000).toISOString(), updated:new Date(now-172800000).toISOString(), due:new Date(now+172800000).toISOString() },
        { id:'fs-1006', display_id:1006, subject:'Printer offline — main office',        description:'HP LaserJet 400 not visible on network',                  requester:'P. Jones',      requester_email:'pjones@district.edu',  group_id:'grp3', group_name:'Franklin Elementary',  assignee:'Dana Lee',       status:'In Progress', priority:'Medium', category:'Network', item:'Printer', created:new Date(now-43200000).toISOString(), updated:new Date(now-21600000).toISOString(), due:new Date(now+100800000).toISOString() },
        { id:'fs-1007', display_id:1007, subject:'Network switch in reboot loop',        description:'Closet B switch cycling every 2 minutes, all users down', requester:'IT Admin',      requester_email:'admin@district.edu',   group_id:'grp4', group_name:'District Office',      assignee:'Sarah Johnson',  status:'Open',     priority:'Urgent', category:'Network', item:'Switch',      created:new Date(now-1800000).toISOString(),   updated:new Date(now-1800000).toISOString(),   due:new Date(now+3600000).toISOString()   },
        { id:'fs-1008', display_id:1008, subject:'VPN access request — new hire',        description:'Maria Gonzalez starting Monday needs VPN credentials',    requester:'HR Dept',       requester_email:'hr@district.edu',      group_id:'grp4', group_name:'District Office',      assignee:'Dana Lee',       status:'Resolved', priority:'Low',    category:'Access',  item:'VPN',         created:new Date(now-259200000).toISOString(), updated:new Date(now-86400000).toISOString(),  due:null },
      ]
      const agents = [
        { id:'ag1', name:'Sarah Johnson', email:'sjohnson@district.edu', group_ids:['grp1','grp4'], open_tickets:4, role:'IT Technician' },
        { id:'ag2', name:'Mike Torres',   email:'mtorres@district.edu',  group_ids:['grp1','grp2'], open_tickets:3, role:'IT Technician' },
        { id:'ag3', name:'Dana Lee',      email:'dlee@district.edu',     group_ids:['grp2','grp3','grp4'], open_tickets:3, role:'IT Lead' },
      ]
      const categories = [
        { id:'cat1', name:'Hardware',  items:['Chromebook','MacBook','iPad','Printer','Projector','Monitor','Keyboard','Mouse'] },
        { id:'cat2', name:'Software',  items:['Google Workspace','Microsoft 365','Application','Browser'] },
        { id:'cat3', name:'Network',   items:['Wi-Fi','Switch','Firewall','VPN','Printer'] },
        { id:'cat4', name:'Account',   items:['Google Workspace','Active Directory','Email','VPN'] },
        { id:'cat5', name:'AV',        items:['Projector','Smart Board','Speaker','Webcam'] },
        { id:'cat6', name:'Access',    items:['VPN','Badge Access','MFA','Password Reset'] },
      ]
      const sync_data = { groups, tickets, agents, categories, mock_notes, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'freshservice', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'freshservice', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }
    if (action === 'load') {
      const { data, error } = await sb.from('connector_credentials').select('sync_data, last_sync').eq('org_id', org_id).eq('connector_id', 'freshservice').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') throw new Error('Mock mode — use real Freshservice domain and API key')
      const [tkRes, agRes, grRes] = await Promise.all([
        fsFetch(creds, '/tickets?per_page=100&page=1&order_by=created_at&order_type=desc&include=requester,stats'),
        fsFetch(creds, '/agents?per_page=100'),
        fsFetch(creds, '/groups?per_page=100'),
      ])
      const [tkData, agData, grData] = await Promise.all([tkRes.json(), agRes.json(), grRes.json()])
      const tickets = (tkData.tickets || []).map((t: any) => ({
        id:'fs-'+t.id, display_id:t.id, subject:t.subject, description:t.description_text || '',
        requester:t.requester?.name || '', requester_email:t.requester?.email || '',
        group_id:'grp-'+t.group_id, assignee:'', status:FS_STATUS[t.status] || 'Open',
        priority:FS_PRIORITY[t.priority] || 'Medium', category:t.category || '',
        created:t.created_at, updated:t.updated_at, due:t.due_by,
      }))
      const agents = (agData.agents || []).map((a: any) => ({
        id:'ag-'+a.id, name:`${a.first_name} ${a.last_name}`, email:a.email,
        group_ids:(a.group_memberships || []).map((g: any) => 'grp-'+g.group_id), open_tickets:0, role:a.role_ids?.length?'Agent':'Viewer',
      }))
      const groups = (grData.groups || []).map((g: any) => ({ id:'grp-'+g.id, name:g.name, abbr:'', ticket_count:0 }))
      const sync_data = { groups, tickets, agents, categories: [], mock_notes: {}, synced_at: new Date().toISOString() }
      await sb.from('connector_credentials').update({ sync_data, last_sync: new Date().toISOString() }).eq('org_id', org_id).eq('connector_id', 'freshservice')
      return respond({ ok:true, counts: { tickets: tickets.length } })
    }

    if (action === 'get_ticket') {
      const { credentials: creds, sync_data } = await getCreds()
      const numId = ticket_id.replace('fs-','')
      if (creds.mode === 'mock') {
        const notes = sync_data?.mock_notes?.[ticket_id] || []
        return respond({ ok:true, notes })
      }
      const res = await fsFetch(creds, `/tickets/${numId}/conversations`)
      const data = await res.json()
      const notes = (data.conversations || []).map((c: any) => ({
        id:'cn-'+c.id, author:c.user_id ? String(c.user_id) : 'System',
        created:c.created_at, private:c.private || false, body:c.body_text || c.body || '',
      }))
      return respond({ ok:true, notes })
    }

    if (action === 'add_note') {
      const { credentials: creds } = await getCreds()
      const numId = ticket_id.replace('fs-','')
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: note added' })
      const res = await fsFetch(creds, `/tickets/${numId}/notes`, 'POST', { body:payload.body, private:payload.internal||false })
      if (!res.ok) throw new Error(`Add note error: ${res.status}`)
      return respond({ ok:true })
    }

    if (action === 'update_ticket') {
      const { credentials: creds } = await getCreds()
      const numId = ticket_id.replace('fs-','')
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: ticket updated' })
      const statusMap: Record<string, number> = { 'Open':2, 'Pending':3, 'Resolved':4, 'Closed':5 }
      const res = await fsFetch(creds, `/tickets/${numId}`, 'PUT', { status:statusMap[payload.status]||2 })
      if (!res.ok) throw new Error(`Update ticket error: ${res.status}`)
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
