# -*- coding: utf-8 -*-
{
    'name': 'Registrierkasse Österreich - Zahle Rechnung',
    'version': '10.0.0.1',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Registrierkassenpflicht Modul für Österreich',
    'website': 'https://www.callino.at/page/rksv',
    'description': """
Registrierkasse Österreich - Rechnung
=====================================
""",
    'author': 'Wolfgang Pichler (Callino), Wolfgang Taferner (WT-IO-IT GmbH)',
    'depends': ['point_of_sale', 'pos_rksv', 'pos_pay_invoice'],
    'test': [
    ],
    'data': [
    ],
    'qweb': [
    ],
    'installable': True,
    'auto_install': True,
    "external_dependencies": {
        "python": [],
        "bin": []
    },
}
