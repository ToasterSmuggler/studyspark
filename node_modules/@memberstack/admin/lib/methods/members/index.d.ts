import { Request } from "../../request";
import { SinglePayload } from "../../types/payload";
import { Payload } from "../../types/payload";
import { Params } from "../../types/params";
export default class MemberMethods extends Request {
    private endpoint;
    constructor(secretKey: any, test?: boolean);
    list(params?: Params.ListMembers): Promise<any>;
    create(params: Params.CreateMember): Promise<SinglePayload<Payload.Transforms["Member"]>>;
    retrieve(params: Params.RetrieveMember): Promise<SinglePayload<Payload.Transforms["Member"]>>;
    update(params: Params.UpdateMember): Promise<SinglePayload<Payload.Transforms["Member"]>>;
    delete(params: Params.DeleteMember): Promise<SinglePayload<{
        id: string;
    }>>;
    addFreePlan(params: Params.AddFreePlan): Promise<void>;
    removeFreePlan(params: Params.RemoveFreePlan): Promise<void>;
}
