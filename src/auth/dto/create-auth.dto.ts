import { IsNumber, IsString } from "class-validator";

export class CreateAuthDto {

    @IsString()
    public name: string;

    public paternal_sername: string;

    public maternal_surname: string;

    @IsNumber()
    public phone: number;

    public email: string;

    public password: string;

    public university: string;

    public educational_program: string;

    public grade: string;

    public group: string;

    public kit: string;

    public workshop: string;

    /* public talla: string;

    public telefono: number;

    public haha: number;

    public folio: string;

    public ordenPago: string;

    public pago_folio: string;

    public cargo_id: number;

    public taller_id: number; */
}
