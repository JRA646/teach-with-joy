import { describe, expect, it } from 'vitest'
import { matchesConditions, readPath } from './workflowRules'

describe('workflowRules',()=>{
 it('reads nested values',()=>expect(readPath({student:{attendance:{rate:92}}},'student.attendance.rate')).toBe(92))
 it('evaluates equality and numeric conditions',()=>expect(matchesConditions([{field:'attendance.rate',operator:'greater_than',value:80},{field:'status',operator:'equals',value:'active'}],{attendance:{rate:92},status:'active'})).toBe(true))
 it('supports contains and existence checks',()=>expect(matchesConditions([{field:'name',operator:'contains',value:'joy'},{field:'email',operator:'exists'}],{name:'TeachWithJoy',email:'a@b.com'})).toBe(true))
 it('fails when a condition is not met',()=>expect(matchesConditions([{field:'attendance.rate',operator:'less_than',value:80}],{attendance:{rate:92}})).toBe(false))
})
