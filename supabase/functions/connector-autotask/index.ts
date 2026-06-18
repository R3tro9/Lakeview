import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const AT_STATUS: Record<number, string> = { 1:'Open', 5:'Closed', 8:'In Progress', 9:'Waiting on Customer', 14:'In Review' }
const STATUS_AT: Record<string, number> = { 'Open':1, 'In Progress':8, 'Waiting on Customer':9, 'Closed':5 }

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
      const { data, error } = await sb
        .from('connector_credentials')
        .select('credentials, sync_data')
        .eq('org_id', org_id)
        .eq('connector_id', 'autotask')
        .single()
      if (error) throw error
      return data
    }

    function atFetch(creds: any, path: string, method = 'GET', body?: unknown) {
      return fetch(`${creds.base_url}${path}`, {
        method,
        headers: { 'UserName': creds.username, 'Secret': creds.api_key, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    // ── TEST ───────────────────────────────────────────────────────────────
    if (action === 'test') {
      const groups = [
        { id:'g1', name:'Lincoln High School',     abbr:'HS'       },
        { id:'g2', name:'Jefferson Middle School', abbr:'MS'       },
        { id:'g3', name:'Franklin Elementary',     abbr:'ES'       },
        { id:'g4', name:'District Office',         abbr:'District' },
      ]
      const now = Date.now()
      const tickets = [
        { id:1,  number:'T20001', title:'Laptop screen cracked',              description:'Student dropped device during lunch',       assignee:'Sarah Johnson', group_id:'g1', group_name:'Lincoln High School',     status:'Open',        priority:'High',   created:new Date(now-7200000).toISOString(),   updated:new Date(now-3600000).toISOString()   },
        { id:2,  number:'T20002', title:'Projector not connecting to HDMI',   description:'Room 204 projector',                       assignee:'Mike Torres',   group_id:'g1', group_name:'Lincoln High School',     status:'In Progress', priority:'Medium', created:new Date(now-18000000).toISOString(),  updated:new Date(now-7200000).toISOString()   },
        { id:3,  number:'T20003', title:"iPad won't charge",                  description:'3rd period class set, 4 devices affected',  assignee:'Sarah Johnson', group_id:'g2', group_name:'Jefferson Middle School', status:'Open',        priority:'High',   created:new Date(now-3600000).toISOString(),   updated:new Date(now-3600000).toISOString()   },
        { id:4,  number:'T20004', title:'Student login not working',          description:'Google account locked',                    assignee:'Dana Lee',      group_id:'g2', group_name:'Jefferson Middle School', status:'Open',        priority:'Medium', created:new Date(now-86400000).toISOString(),  updated:new Date(now-43200000).toISOString()  },
        { id:5,  number:'T20005', title:'Chromebook keyboard stuck',          description:'Keys W and S unresponsive',               assignee:'Mike Torres',   group_id:'g3', group_name:'Franklin Elementary',     status:'Open',        priority:'Low',    created:new Date(now-172800000).toISOString(), updated:new Date(now-172800000).toISOString() },
        { id:6,  number:'T20006', title:'Printer offline in office',          description:'HP LaserJet 400 not found on network',     assignee:'Dana Lee',      group_id:'g3', group_name:'Franklin Elementary',     status:'In Progress', priority:'Medium', created:new Date(now-43200000).toISOString(),  updated:new Date(now-21600000).toISOString()  },
        { id:7,  number:'T20007', title:'Network switch rebooting loop',      description:'Closet B switch cycling every 2 min',      assignee:'Sarah Johnson', group_id:'g4', group_name:'District Office',         status:'Open',        priority:'Urgent', created:new Date(now-1800000).toISOString(),   updated:new Date(now-1800000).toISOString()   },
        { id:8,  number:'T20008', title:'VPN access request – new hire',      description:'Maria Gonzalez, starts Monday',            assignee:'Dana Lee',      group_id:'g4', group_name:'District Office',         status:'Closed',      priority:'Low',    created:new Date(now-259200000).toISOString(), updated:new Date(now-86400000).toISOString()  },
        { id:9,  number:'T20009', title:'Smart board calibration needed',     description:'Room 112',                                assignee:'Mike Torres',   group_id:'g1', group_name:'Lincoln High School',     status:'Closed',      priority:'Low',    created:new Date(now-345600000).toISOString(), updated:new Date(now-259200000).toISOString() },
        { id:10, number:'T20010', title:'Missing device – asset tag LHS-042', description:'Not seen since field trip',               assignee:'Sarah Johnson', group_id:'g1', group_name:'Lincoln High School',     status:'Open',        priority:'High',   created:new Date(now-21600000).toISOString(),  updated:new Date(now-21600000).toISOString()  },
      ]
      const mock_notes: Record<number, any[]> = {
        1: [
          { id:101, author:'Sarah Johnson', created:new Date(now-3600000).toISOString(),  internal:false, body:'Checked the device. Screen cracked top-right corner. Requesting replacement screen from inventory.' },
          { id:102, author:'System',        created:new Date(now-7200000).toISOString(),  internal:true,  body:'Ticket auto-assigned to Sarah Johnson based on location: Lincoln High School.' },
        ],
        2: [
          { id:201, author:'Mike Torres',   created:new Date(now-7200000).toISOString(),  internal:false, body:'Tested with a different HDMI cable — same issue. Appears to be the projector input port. Will escalate for hardware repair.' },
        ],
        7: [
          { id:701, author:'Sarah Johnson', created:new Date(now-1800000).toISOString(),  internal:true,  body:'On-site now. Switch is cycling every 90 seconds. Possible power supply failure. Ordered replacement.' },
          { id:702, author:'Mike Torres',   created:new Date(now-900000).toISOString(),   internal:false, body:'Notified district IT director. Temporary switch pulled from storage to restore connectivity.' },
        ],
      }
      const sync_data = { groups, tickets, mock_notes, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'autotask', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    // ── SAVE ───────────────────────────────────────────────────────────────
    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'autotask', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }

    // ── SYNC (real Autotask) ───────────────────────────────────────────────
    if (action === 'sync') {
      const { credentials: creds } = await getCreds()

      const tRes = await atFetch(creds, '/Tickets?search={"filter":[{"field":"Status","op":"noteq","value":5}],"MaxRecords":500}')
      if (!tRes.ok) throw new Error(`Autotask tickets API error: ${tRes.status}`)
      const rawTickets: any[] = (await tRes.json()).items || []

      const companyMap: Record<number, string> = {}
      const groups: any[] = []
      const cRes = await atFetch(creds, '/Companies?search={"filter":[{"field":"isActive","op":"eq","value":true}],"MaxRecords":500}')
      if (cRes.ok) {
        for (const c of ((await cRes.json()).items || [])) {
          companyMap[c.id] = c.companyName
          groups.push({ id: String(c.id), name: c.companyName, abbr: c.companyName.split(' ').map((w: string) => w[0]).join('').slice(0,4) })
        }
      }

      const resourceMap: Record<number, string> = {}
      const rRes = await atFetch(creds, '/Resources?search={"filter":[{"field":"isActive","op":"eq","value":true}],"MaxRecords":500}')
      if (rRes.ok) {
        for (const r of ((await rRes.json()).items || [])) {
          resourceMap[r.id] = `${r.firstName} ${r.lastName}`.trim()
        }
      }

      const tickets = rawTickets.map((t: any) => ({
        id:          t.id,
        number:      t.ticketNumber,
        title:       t.title,
        description: t.description || '',
        assignee:    resourceMap[t.assignedResourceID] || 'Unassigned',
        group_id:    String(t.companyID),
        group_name:  companyMap[t.companyID] || 'Unknown',
        status:      AT_STATUS[t.status] || 'Open',
        priority:    t.priority === 1 ? 'Urgent' : t.priority === 2 ? 'High' : t.priority === 3 ? 'Medium' : 'Low',
        created:     t.createDate,
        updated:     t.lastActivityDate,
      }))

      const sync_data = { groups, tickets, synced_at: new Date().toISOString() }
      await sb.from('connector_credentials')
        .update({ sync_data, last_sync: new Date().toISOString() })
        .eq('org_id', org_id).eq('connector_id', 'autotask')
      return respond({ ok:true, count: tickets.length })
    }

    // ── LOAD ───────────────────────────────────────────────────────────────
    if (action === 'load') {
      const { data, error } = await sb
        .from('connector_credentials').select('sync_data, last_sync')
        .eq('org_id', org_id).eq('connector_id', 'autotask').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    // ── GET_TICKET ─────────────────────────────────────────────────────────
    if (action === 'get_ticket') {
      const { credentials: creds, sync_data } = await getCreds()
      if (creds.mode === 'mock') {
        const notes = sync_data?.mock_notes?.[Number(ticket_id)] || []
        return respond({ ok:true, notes })
      }
      const nRes = await atFetch(creds, `/TicketNotes?search={"filter":[{"field":"TicketID","op":"eq","value":${ticket_id}}],"MaxRecords":100}`)
      if (!nRes.ok) throw new Error(`Autotask notes API error: ${nRes.status}`)
      const notes = ((await nRes.json()).items || []).map((n: any) => ({
        id:       n.id,
        author:   n.creatorResourceName || 'Unknown',
        created:  n.createDateTime,
        internal: n.publish === 2,
        body:     n.description || '',
      })).reverse()
      return respond({ ok:true, notes })
    }

    // ── ADD_NOTE ───────────────────────────────────────────────────────────
    if (action === 'add_note') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: note added' })
      const res = await atFetch(creds, '/TicketNotes', 'POST', {
        ticketID:    Number(ticket_id),
        noteType:    1,
        publish:     payload.internal ? 2 : 1,
        title:       'Note from Lakeview',
        description: payload.body,
      })
      if (!res.ok) throw new Error(`Autotask add note error: ${res.status}`)
      const nRes = await atFetch(creds, `/TicketNotes?search={"filter":[{"field":"TicketID","op":"eq","value":${ticket_id}}],"MaxRecords":100}`)
      const notes = ((await nRes.json()).items || []).map((n: any) => ({
        id: n.id, author: n.creatorResourceName || 'Unknown',
        created: n.createDateTime, internal: n.publish === 2, body: n.description || '',
      })).reverse()
      return respond({ ok:true, notes })
    }

    // ── UPDATE_TICKET ──────────────────────────────────────────────────────
    if (action === 'update_ticket') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: ticket updated' })
      const atStatus = STATUS_AT[payload.status]
      if (!atStatus) throw new Error(`Unknown status: ${payload.status}`)
      const res = await atFetch(creds, `/Tickets/${ticket_id}`, 'PATCH', {
        id: Number(ticket_id), status: atStatus,
      })
      if (!res.ok) throw new Error(`Autotask update ticket error: ${res.status}`)
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)

  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
